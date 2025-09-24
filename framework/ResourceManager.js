/**
 * ResourceManager - 系統資源管理器
 *
 * 功能：
 * - 管理CPU、記憶體、網路、儲存等系統資源池
 * - 動態資源分配和回收機制
 * - 資源使用監控和限制控制
 * - 支援資源預留和優先級分配
 * - 提供資源使用統計和性能分析
 *
 * 用途：為並行Agent執行提供資源調度和管理支持
 * 配合：與DependencyResolver和AgentManager協作實現最優資源利用
 */

const { EventEmitter } = require('events');
const os = require('os');

/**
 * 資源類型定義
 */
const RESOURCE_TYPES = {
    CPU: 'cpu',
    MEMORY: 'memory',
    NETWORK: 'network',
    STORAGE: 'storage',
    FILE_HANDLES: 'file_handles',
    THREAD_POOL: 'thread_pool'
};

/**
 * 資源狀態
 */
const RESOURCE_STATUS = {
    AVAILABLE: 'available',
    ALLOCATED: 'allocated',
    RESERVED: 'reserved',
    EXHAUSTED: 'exhausted',
    ERROR: 'error'
};

/**
 * 資源池類
 */
class ResourcePool {
    constructor(type, options = {}) {
        this.type = type;
        this.options = {
            maxCapacity: options.maxCapacity || this._getDefaultCapacity(type),
            minReserved: options.minReserved || 0,
            allocationUnit: options.allocationUnit || 1,
            autoScale: options.autoScale !== false,
            scaleThreshold: options.scaleThreshold || 0.8,
            scaleStep: options.scaleStep || 0.2,
            ...options
        };

        this.totalCapacity = this.options.maxCapacity;
        this.allocatedAmount = 0;
        this.reservedAmount = 0;
        this.availableAmount = this.totalCapacity - this.reservedAmount;

        this.allocations = new Map(); // allocationId -> allocation info
        this.reservations = new Map(); // reservationId -> reservation info
        this.waitingQueue = []; // 等待分配的請求

        this.status = RESOURCE_STATUS.AVAILABLE;
        this.lastUpdate = Date.now();

        // 統計信息
        this.stats = {
            totalAllocations: 0,
            totalReleases: 0,
            peakUsage: 0,
            allocationFailures: 0,
            averageHoldTime: 0,
            utilizationHistory: [] // 使用率歷史
        };
    }

    /**
     * 分配資源
     * @param {number} amount - 請求的資源量
     * @param {Object} options - 分配選項
     * @returns {Object} - 分配結果
     */
    async allocate(amount, options = {}) {
        const allocationId = this._generateAllocationId();
        const request = {
            id: allocationId,
            amount,
            priority: options.priority || 0,
            timeout: options.timeout || 30000,
            metadata: options.metadata || {},
            timestamp: Date.now()
        };

        try {
            // 檢查即時分配可能性
            if (this._canAllocateImmediately(amount)) {
                return await this._performAllocation(request);
            }

            // 檢查是否可以通過自動縮放滿足
            if (this.options.autoScale && this._shouldAutoScale(amount)) {
                await this._autoScale();
                if (this._canAllocateImmediately(amount)) {
                    return await this._performAllocation(request);
                }
            }

            // 加入等待佇列
            if (options.wait !== false) {
                return await this._enqueueAllocation(request);
            }

            // 分配失敗
            this.stats.allocationFailures++;
            throw new Error(`資源不足，無法分配 ${amount} 單位的 ${this.type}`);

        } catch (error) {
            this.stats.allocationFailures++;
            throw error;
        }
    }

    /**
     * 釋放資源
     * @param {string} allocationId - 分配ID
     * @returns {boolean} - 釋放是否成功
     */
    async release(allocationId) {
        const allocation = this.allocations.get(allocationId);
        if (!allocation) {
            return false;
        }

        try {
            // 執行釋放
            this.allocatedAmount -= allocation.amount;
            this.availableAmount += allocation.amount;

            // 更新統計
            const holdTime = Date.now() - allocation.timestamp;
            this._updateHoldTimeStats(holdTime);

            // 移除分配記錄
            this.allocations.delete(allocationId);
            this.stats.totalReleases++;

            // 更新狀態
            this._updateStatus();

            // 處理等待佇列
            await this._processWaitingQueue();

            console.log(`[ResourcePool:${this.type}] 釋放資源: ${allocation.amount} 單位 (ID: ${allocationId})`);
            return true;

        } catch (error) {
            console.error(`[ResourcePool:${this.type}] 釋放資源失敗:`, error);
            return false;
        }
    }

    /**
     * 預留資源
     * @param {number} amount - 預留的資源量
     * @param {Object} options - 預留選項
     * @returns {string} - 預留ID
     */
    async reserve(amount, options = {}) {
        const reservationId = this._generateReservationId();

        if (this.availableAmount - amount < 0) {
            throw new Error(`無法預留 ${amount} 單位的 ${this.type}，可用資源不足`);
        }

        const reservation = {
            id: reservationId,
            amount,
            expiry: options.expiry ? Date.now() + options.expiry : null,
            metadata: options.metadata || {},
            timestamp: Date.now()
        };

        this.reservedAmount += amount;
        this.availableAmount -= amount;
        this.reservations.set(reservationId, reservation);

        // 設置過期清理
        if (reservation.expiry) {
            setTimeout(() => {
                this.unreserve(reservationId);
            }, options.expiry);
        }

        this._updateStatus();
        return reservationId;
    }

    /**
     * 取消預留
     * @param {string} reservationId - 預留ID
     * @returns {boolean} - 是否成功取消
     */
    async unreserve(reservationId) {
        const reservation = this.reservations.get(reservationId);
        if (!reservation) {
            return false;
        }

        this.reservedAmount -= reservation.amount;
        this.availableAmount += reservation.amount;
        this.reservations.delete(reservationId);

        this._updateStatus();
        await this._processWaitingQueue();

        return true;
    }

    /**
     * 調整容量
     * @param {number} newCapacity - 新容量
     */
    async adjustCapacity(newCapacity) {
        if (newCapacity < this.allocatedAmount + this.reservedAmount) {
            throw new Error('新容量不能小於已分配和預留的資源總量');
        }

        const oldCapacity = this.totalCapacity;
        this.totalCapacity = newCapacity;
        this.availableAmount = this.totalCapacity - this.allocatedAmount - this.reservedAmount;

        this._updateStatus();

        if (newCapacity > oldCapacity) {
            // 容量增加，處理等待佇列
            await this._processWaitingQueue();
        }

        console.log(`[ResourcePool:${this.type}] 調整容量: ${oldCapacity} -> ${newCapacity}`);
    }

    /**
     * 獲取使用率
     */
    getUtilization() {
        return (this.allocatedAmount + this.reservedAmount) / this.totalCapacity;
    }

    /**
     * 獲取資源池狀態
     */
    getStatus() {
        return {
            type: this.type,
            status: this.status,
            totalCapacity: this.totalCapacity,
            allocatedAmount: this.allocatedAmount,
            reservedAmount: this.reservedAmount,
            availableAmount: this.availableAmount,
            utilization: this.getUtilization(),
            allocationsCount: this.allocations.size,
            reservationsCount: this.reservations.size,
            waitingCount: this.waitingQueue.length,
            stats: { ...this.stats },
            lastUpdate: this.lastUpdate
        };
    }

    // ========== 私有方法 ==========

    /**
     * 獲取預設容量
     * @private
     */
    _getDefaultCapacity(type) {
        switch (type) {
            case RESOURCE_TYPES.CPU:
                return os.cpus().length * 100; // 每個CPU 100單位
            case RESOURCE_TYPES.MEMORY:
                return Math.floor(os.totalmem() / (1024 * 1024)); // MB
            case RESOURCE_TYPES.NETWORK:
                return 1000; // 1000 Mbps
            case RESOURCE_TYPES.STORAGE:
                return 10000; // 10GB
            case RESOURCE_TYPES.FILE_HANDLES:
                return 1000; // 1000個檔案控制代碼
            case RESOURCE_TYPES.THREAD_POOL:
                return os.cpus().length * 2; // 每個CPU 2個線程
            default:
                return 100;
        }
    }

    /**
     * 檢查是否可以立即分配
     * @private
     */
    _canAllocateImmediately(amount) {
        return this.availableAmount >= amount &&
               this.status !== RESOURCE_STATUS.ERROR;
    }

    /**
     * 執行資源分配
     * @private
     */
    async _performAllocation(request) {
        const { id, amount, metadata } = request;

        this.allocatedAmount += amount;
        this.availableAmount -= amount;

        const allocation = {
            id,
            amount,
            timestamp: Date.now(),
            metadata
        };

        this.allocations.set(id, allocation);
        this.stats.totalAllocations++;

        // 更新峰值使用
        const currentUsage = this.allocatedAmount + this.reservedAmount;
        if (currentUsage > this.stats.peakUsage) {
            this.stats.peakUsage = currentUsage;
        }

        this._updateStatus();
        this._recordUtilization();

        console.log(`[ResourcePool:${this.type}] 分配資源: ${amount} 單位 (ID: ${id})`);

        return {
            success: true,
            allocationId: id,
            amount,
            remainingCapacity: this.availableAmount
        };
    }

    /**
     * 加入等待佇列
     * @private
     */
    async _enqueueAllocation(request) {
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                // 從佇列中移除
                const index = this.waitingQueue.findIndex(item => item.request.id === request.id);
                if (index !== -1) {
                    this.waitingQueue.splice(index, 1);
                }
                reject(new Error(`資源分配超時: ${this.type}`));
            }, request.timeout);

            this.waitingQueue.push({
                request,
                resolve,
                reject,
                timeoutHandle
            });

            // 按優先級排序
            this.waitingQueue.sort((a, b) => b.request.priority - a.request.priority);
        });
    }

    /**
     * 處理等待佇列
     * @private
     */
    async _processWaitingQueue() {
        while (this.waitingQueue.length > 0) {
            const item = this.waitingQueue[0];

            if (this._canAllocateImmediately(item.request.amount)) {
                this.waitingQueue.shift();
                clearTimeout(item.timeoutHandle);

                try {
                    const result = await this._performAllocation(item.request);
                    item.resolve(result);
                } catch (error) {
                    item.reject(error);
                }
            } else {
                break; // 無法分配，停止處理
            }
        }
    }

    /**
     * 檢查是否應該自動縮放
     * @private
     */
    _shouldAutoScale(requestedAmount) {
        const currentUtilization = this.getUtilization();
        const futureUtilization = (this.allocatedAmount + this.reservedAmount + requestedAmount) / this.totalCapacity;

        return currentUtilization > this.options.scaleThreshold ||
               futureUtilization > this.options.scaleThreshold;
    }

    /**
     * 自動縮放
     * @private
     */
    async _autoScale() {
        const scaleAmount = Math.ceil(this.totalCapacity * this.options.scaleStep);
        const newCapacity = this.totalCapacity + scaleAmount;

        await this.adjustCapacity(newCapacity);
        console.log(`[ResourcePool:${this.type}] 自動縮放: +${scaleAmount} (新容量: ${newCapacity})`);
    }

    /**
     * 更新狀態
     * @private
     */
    _updateStatus() {
        const utilization = this.getUtilization();

        if (utilization >= 1.0) {
            this.status = RESOURCE_STATUS.EXHAUSTED;
        } else if (this.availableAmount <= 0) {
            this.status = RESOURCE_STATUS.ALLOCATED;
        } else {
            this.status = RESOURCE_STATUS.AVAILABLE;
        }

        this.lastUpdate = Date.now();
    }

    /**
     * 更新持有時間統計
     * @private
     */
    _updateHoldTimeStats(holdTime) {
        const totalReleases = this.stats.totalReleases;
        this.stats.averageHoldTime = (
            this.stats.averageHoldTime * (totalReleases - 1) + holdTime
        ) / totalReleases;
    }

    /**
     * 記錄使用率歷史
     * @private
     */
    _recordUtilization() {
        const now = Date.now();
        const utilization = this.getUtilization();

        this.stats.utilizationHistory.push({
            timestamp: now,
            utilization
        });

        // 限制歷史記錄數量（保留最近1小時，每分鐘一個點）
        const maxRecords = 60;
        if (this.stats.utilizationHistory.length > maxRecords) {
            this.stats.utilizationHistory = this.stats.utilizationHistory.slice(-maxRecords);
        }
    }

    /**
     * 生成分配ID
     * @private
     */
    _generateAllocationId() {
        return `${this.type}_alloc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * 生成預留ID
     * @private
     */
    _generateReservationId() {
        return `${this.type}_res_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
}

/**
 * 系統資源管理器主類
 */
class ResourceManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 資源池配置
            enableCpuManagement: true,
            enableMemoryManagement: true,
            enableNetworkManagement: true,
            enableStorageManagement: false,

            // 監控配置
            monitoringInterval: 5000, // 5秒
            enableResourceMonitoring: true,
            enableAutoCleanup: true,

            // 警告閾值
            utilizationWarningThreshold: 0.8,
            utilizationCriticalThreshold: 0.95,

            // 清理配置
            cleanupInterval: 60000, // 1分鐘
            maxAllocationAge: 600000, // 10分鐘

            ...options
        };

        // 資源池集合
        this.resourcePools = new Map();

        // 全域分配追蹤
        this.globalAllocations = new Map(); // 跨池分配追蹤

        // 監控系統
        this.monitoringTimer = null;
        this.cleanupTimer = null;

        // 統計信息
        this.systemStats = {
            totalAllocations: 0,
            totalReleases: 0,
            activeAllocations: 0,
            resourceUtilization: {},
            systemLoad: null,
            lastMonitoring: null
        };

        // 警告系統
        this.warnings = [];
        this.criticalWarnings = [];

        this._initializeResourcePools();
    }

    /**
     * 初始化系統
     */
    async initialize() {
        try {
            console.log('[ResourceManager] 初始化系統資源管理器...');

            // 初始化資源池
            await this._initializeResourcePools();

            // 開始監控
            if (this.options.enableResourceMonitoring) {
                this._startMonitoring();
            }

            // 開始清理任務
            if (this.options.enableAutoCleanup) {
                this._startCleanupTask();
            }

            this.emit('initialized');
            console.log('[ResourceManager] 系統資源管理器已初始化');

        } catch (error) {
            console.error('[ResourceManager] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 分配資源集合
     * @param {Object} requirements - 資源需求
     * @param {Object} options - 分配選項
     * @returns {Object} - 分配結果
     */
    async allocateResources(requirements, options = {}) {
        const allocationId = this._generateGlobalAllocationId();
        const allocations = new Map();
        const startTime = Date.now();

        try {
            console.log(`[ResourceManager] 開始分配資源集合 (ID: ${allocationId}):`, requirements);

            // 檢查資源可用性
            const availabilityCheck = await this._checkResourceAvailability(requirements);
            if (!availabilityCheck.feasible) {
                throw new Error(`資源不足: ${availabilityCheck.reason}`);
            }

            // 按優先級順序分配資源
            const resourceTypes = Object.keys(requirements).sort((a, b) => {
                const priorityA = this._getResourcePriority(a);
                const priorityB = this._getResourcePriority(b);
                return priorityB - priorityA; // 高優先級先分配
            });

            for (const resourceType of resourceTypes) {
                const amount = requirements[resourceType];
                const pool = this.resourcePools.get(resourceType);

                if (!pool) {
                    throw new Error(`未知的資源類型: ${resourceType}`);
                }

                const result = await pool.allocate(amount, {
                    ...options,
                    globalAllocationId: allocationId
                });

                allocations.set(resourceType, result);
            }

            // 記錄全域分配
            const globalAllocation = {
                id: allocationId,
                requirements,
                allocations,
                timestamp: startTime,
                options,
                status: 'active'
            };

            this.globalAllocations.set(allocationId, globalAllocation);
            this.systemStats.totalAllocations++;
            this.systemStats.activeAllocations++;

            this.emit('resourcesAllocated', globalAllocation);

            return {
                success: true,
                allocationId,
                allocations: Object.fromEntries(allocations),
                allocationTime: Date.now() - startTime
            };

        } catch (error) {
            console.error(`[ResourceManager] 資源分配失敗 (ID: ${allocationId}):`, error);

            // 回滾已分配的資源
            await this._rollbackAllocations(allocations);

            throw error;
        }
    }

    /**
     * 釋放資源集合
     * @param {string} allocationId - 分配ID
     * @returns {boolean} - 釋放是否成功
     */
    async releaseResources(allocationId) {
        const globalAllocation = this.globalAllocations.get(allocationId);
        if (!globalAllocation) {
            console.warn(`[ResourceManager] 全域分配不存在: ${allocationId}`);
            return false;
        }

        try {
            console.log(`[ResourceManager] 開始釋放資源集合 (ID: ${allocationId})`);

            const releaseResults = new Map();
            let allReleased = true;

            // 釋放各個資源池中的分配
            for (const [resourceType, allocation] of globalAllocation.allocations) {
                const pool = this.resourcePools.get(resourceType);
                if (pool) {
                    const released = await pool.release(allocation.allocationId);
                    releaseResults.set(resourceType, released);
                    if (!released) {
                        allReleased = false;
                    }
                }
            }

            // 更新全域分配狀態
            globalAllocation.status = allReleased ? 'released' : 'partially_released';
            globalAllocation.releaseTime = Date.now();

            // 從活動列表中移除
            if (allReleased) {
                this.globalAllocations.delete(allocationId);
                this.systemStats.activeAllocations--;
            }

            this.systemStats.totalReleases++;
            this.emit('resourcesReleased', { allocationId, success: allReleased, results: releaseResults });

            return allReleased;

        } catch (error) {
            console.error(`[ResourceManager] 釋放資源失敗 (ID: ${allocationId}):`, error);
            return false;
        }
    }

    /**
     * 預留資源集合
     * @param {Object} requirements - 資源需求
     * @param {Object} options - 預留選項
     * @returns {Object} - 預留結果
     */
    async reserveResources(requirements, options = {}) {
        const reservationId = this._generateGlobalReservationId();
        const reservations = new Map();

        try {
            for (const [resourceType, amount] of Object.entries(requirements)) {
                const pool = this.resourcePools.get(resourceType);
                if (!pool) {
                    throw new Error(`未知的資源類型: ${resourceType}`);
                }

                const reservationResult = await pool.reserve(amount, options);
                reservations.set(resourceType, reservationResult);
            }

            this.emit('resourcesReserved', { reservationId, requirements, reservations });

            return {
                success: true,
                reservationId,
                reservations: Object.fromEntries(reservations)
            };

        } catch (error) {
            // 回滾已預留的資源
            for (const [resourceType, resId] of reservations) {
                const pool = this.resourcePools.get(resourceType);
                if (pool) {
                    await pool.unreserve(resId);
                }
            }

            throw error;
        }
    }

    /**
     * 獲取系統資源狀態
     */
    getSystemStatus() {
        const poolStatuses = {};

        for (const [type, pool] of this.resourcePools) {
            poolStatuses[type] = pool.getStatus();
        }

        return {
            pools: poolStatuses,
            globalStats: { ...this.systemStats },
            activeAllocations: this.systemStats.activeAllocations,
            warnings: this.warnings.slice(-10), // 最近10個警告
            criticalWarnings: this.criticalWarnings.slice(-5), // 最近5個重要警告
            systemLoad: this._getSystemLoad(),
            lastUpdate: Date.now()
        };
    }

    /**
     * 優化資源分配
     * @param {Object} options - 優化選項
     */
    async optimizeResourceAllocation(options = {}) {
        console.log('[ResourceManager] 開始資源分配優化...');

        const optimizations = [];

        // 分析各資源池使用情況
        for (const [type, pool] of this.resourcePools) {
            const status = pool.getStatus();

            // 檢查低使用率池
            if (status.utilization < 0.3 && status.totalCapacity > 100) {
                // 考慮縮減容量
                const newCapacity = Math.max(
                    status.allocatedAmount + status.reservedAmount + 50,
                    Math.floor(status.totalCapacity * 0.7)
                );

                if (newCapacity < status.totalCapacity) {
                    await pool.adjustCapacity(newCapacity);
                    optimizations.push({
                        type: 'capacity_reduction',
                        resourceType: type,
                        oldCapacity: status.totalCapacity,
                        newCapacity
                    });
                }
            }

            // 檢查高使用率池
            if (status.utilization > 0.85) {
                const scaleAmount = Math.ceil(status.totalCapacity * 0.2);
                await pool.adjustCapacity(status.totalCapacity + scaleAmount);
                optimizations.push({
                    type: 'capacity_expansion',
                    resourceType: type,
                    oldCapacity: status.totalCapacity,
                    newCapacity: status.totalCapacity + scaleAmount
                });
            }
        }

        this.emit('resourcesOptimized', optimizations);
        console.log(`[ResourceManager] 完成資源優化，執行了 ${optimizations.length} 項調整`);

        return optimizations;
    }

    /**
     * 清理過期資源
     */
    async cleanupExpiredResources() {
        const now = Date.now();
        const expiredAllocations = [];

        // 找到過期的全域分配
        for (const [id, allocation] of this.globalAllocations) {
            const age = now - allocation.timestamp;
            if (age > this.options.maxAllocationAge) {
                expiredAllocations.push(id);
            }
        }

        // 釋放過期分配
        let cleanupCount = 0;
        for (const id of expiredAllocations) {
            const success = await this.releaseResources(id);
            if (success) {
                cleanupCount++;
            }
        }

        if (cleanupCount > 0) {
            console.log(`[ResourceManager] 清理了 ${cleanupCount} 個過期的資源分配`);
        }

        return cleanupCount;
    }

    /**
     * 停止資源管理器
     */
    async shutdown() {
        console.log('[ResourceManager] 正在關閉資源管理器...');

        // 停止監控
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }

        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        // 釋放所有活動分配
        const activeAllocations = Array.from(this.globalAllocations.keys());
        for (const id of activeAllocations) {
            await this.releaseResources(id);
        }

        this.emit('shutdown');
        console.log('[ResourceManager] 資源管理器已關閉');
    }

    // ========== 私有方法 ==========

    /**
     * 初始化資源池
     * @private
     */
    _initializeResourcePools() {
        // CPU資源池
        if (this.options.enableCpuManagement) {
            this.resourcePools.set(RESOURCE_TYPES.CPU, new ResourcePool(RESOURCE_TYPES.CPU, {
                maxCapacity: os.cpus().length * 100,
                autoScale: true,
                scaleThreshold: 0.8
            }));
        }

        // 記憶體資源池
        if (this.options.enableMemoryManagement) {
            this.resourcePools.set(RESOURCE_TYPES.MEMORY, new ResourcePool(RESOURCE_TYPES.MEMORY, {
                maxCapacity: Math.floor(os.totalmem() / (1024 * 1024)), // MB
                autoScale: false, // 記憶體通常不自動擴展
                scaleThreshold: 0.9
            }));
        }

        // 網路資源池
        if (this.options.enableNetworkManagement) {
            this.resourcePools.set(RESOURCE_TYPES.NETWORK, new ResourcePool(RESOURCE_TYPES.NETWORK, {
                maxCapacity: 1000, // 1000 Mbps
                autoScale: true,
                scaleThreshold: 0.7
            }));
        }

        // 儲存資源池
        if (this.options.enableStorageManagement) {
            this.resourcePools.set(RESOURCE_TYPES.STORAGE, new ResourcePool(RESOURCE_TYPES.STORAGE, {
                maxCapacity: 50000, // 50GB
                autoScale: false,
                scaleThreshold: 0.85
            }));
        }

        // 檔案控制代碼池
        this.resourcePools.set(RESOURCE_TYPES.FILE_HANDLES, new ResourcePool(RESOURCE_TYPES.FILE_HANDLES, {
            maxCapacity: 1000,
            autoScale: true,
            scaleThreshold: 0.8
        }));

        // 執行緒池
        this.resourcePools.set(RESOURCE_TYPES.THREAD_POOL, new ResourcePool(RESOURCE_TYPES.THREAD_POOL, {
            maxCapacity: os.cpus().length * 4,
            autoScale: true,
            scaleThreshold: 0.75
        }));

        console.log(`[ResourceManager] 初始化了 ${this.resourcePools.size} 個資源池`);
    }

    /**
     * 開始監控
     * @private
     */
    _startMonitoring() {
        this.monitoringTimer = setInterval(() => {
            this._performMonitoring();
        }, this.options.monitoringInterval);

        console.log('[ResourceManager] 已開始資源監控');
    }

    /**
     * 開始清理任務
     * @private
     */
    _startCleanupTask() {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredResources();
        }, this.options.cleanupInterval);

        console.log('[ResourceManager] 已開始自動清理任務');
    }

    /**
     * 執行監控
     * @private
     */
    _performMonitoring() {
        const now = Date.now();

        // 更新系統負載
        this.systemStats.systemLoad = this._getSystemLoad();
        this.systemStats.lastMonitoring = now;

        // 檢查各資源池
        for (const [type, pool] of this.resourcePools) {
            const status = pool.getStatus();
            this.systemStats.resourceUtilization[type] = status.utilization;

            // 檢查警告閾值
            if (status.utilization > this.options.utilizationCriticalThreshold) {
                this._addCriticalWarning(`${type} 資源使用率過高: ${(status.utilization * 100).toFixed(1)}%`);
            } else if (status.utilization > this.options.utilizationWarningThreshold) {
                this._addWarning(`${type} 資源使用率警告: ${(status.utilization * 100).toFixed(1)}%`);
            }
        }
    }

    /**
     * 獲取系統負載
     * @private
     */
    _getSystemLoad() {
        try {
            const loadavg = os.loadavg();
            return {
                load1: loadavg[0],
                load5: loadavg[1],
                load15: loadavg[2],
                cpuCount: os.cpus().length
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 檢查資源可用性
     * @private
     */
    async _checkResourceAvailability(requirements) {
        const unavailableResources = [];

        for (const [resourceType, amount] of Object.entries(requirements)) {
            const pool = this.resourcePools.get(resourceType);

            if (!pool) {
                unavailableResources.push(`未知資源類型: ${resourceType}`);
                continue;
            }

            if (pool.availableAmount < amount) {
                unavailableResources.push(
                    `${resourceType}: 需要 ${amount}, 可用 ${pool.availableAmount}`
                );
            }
        }

        return {
            feasible: unavailableResources.length === 0,
            reason: unavailableResources.join(', ')
        };
    }

    /**
     * 回滾分配
     * @private
     */
    async _rollbackAllocations(allocations) {
        for (const [resourceType, allocation] of allocations) {
            const pool = this.resourcePools.get(resourceType);
            if (pool && allocation.success) {
                await pool.release(allocation.allocationId);
            }
        }
    }

    /**
     * 獲取資源優先級
     * @private
     */
    _getResourcePriority(resourceType) {
        const priorities = {
            [RESOURCE_TYPES.MEMORY]: 100,
            [RESOURCE_TYPES.CPU]: 90,
            [RESOURCE_TYPES.THREAD_POOL]: 80,
            [RESOURCE_TYPES.FILE_HANDLES]: 70,
            [RESOURCE_TYPES.NETWORK]: 60,
            [RESOURCE_TYPES.STORAGE]: 50
        };

        return priorities[resourceType] || 0;
    }

    /**
     * 添加警告
     * @private
     */
    _addWarning(message) {
        const warning = {
            message,
            timestamp: new Date().toISOString(),
            type: 'warning'
        };

        this.warnings.push(warning);

        // 限制警告數量
        if (this.warnings.length > 100) {
            this.warnings = this.warnings.slice(-100);
        }

        this.emit('warning', warning);
    }

    /**
     * 添加重要警告
     * @private
     */
    _addCriticalWarning(message) {
        const warning = {
            message,
            timestamp: new Date().toISOString(),
            type: 'critical'
        };

        this.criticalWarnings.push(warning);

        // 限制重要警告數量
        if (this.criticalWarnings.length > 50) {
            this.criticalWarnings = this.criticalWarnings.slice(-50);
        }

        this.emit('criticalWarning', warning);
    }

    /**
     * 生成全域分配ID
     * @private
     */
    _generateGlobalAllocationId() {
        return `global_alloc_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }

    /**
     * 生成全域預留ID
     * @private
     */
    _generateGlobalReservationId() {
        return `global_res_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }
}

// 導出常數
ResourceManager.RESOURCE_TYPES = RESOURCE_TYPES;
ResourceManager.RESOURCE_STATUS = RESOURCE_STATUS;

module.exports = ResourceManager;