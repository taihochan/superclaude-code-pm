/**
 * EventBus - 統一事件總線系統
 *
 * 功能：
 * - 中央事件調度和發布訂閱
 * - 整合事件存儲、序列化、中間件
 * - 支持同步和異步事件處理
 * - 事件優先級和批處理機制
 *
 * 用途：CCPM和SuperClaude之間的核心通信基礎設施
 */

const EventEmitter = require('events');
const EventStore = require('./EventStore');
const EventSerializer = require('./EventSerializer');
const { EventMiddleware } = require('./EventMiddleware');

/**
 * 事件訂閱者信息
 */
class EventSubscription {
    constructor(eventName, handler, options = {}) {
        this.id = this._generateId();
        this.eventName = eventName;
        this.handler = handler;
        this.options = {
            once: options.once || false,
            async: options.async !== false,
            priority: options.priority || 0,
            filter: options.filter || null,
            context: options.context || null,
            ...options
        };

        this.stats = {
            invoked: 0,
            errors: 0,
            lastInvocation: null,
            averageProcessingTime: 0
        };

        this.active = true;
    }

    _generateId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    async invoke(event, context = {}) {
        if (!this.active) return null;

        const startTime = Date.now();

        try {
            // 應用過濾器
            if (this.options.filter && !(await this.options.filter(event, context))) {
                return null;
            }

            // 執行處理器
            let result;
            if (this.options.async) {
                result = await this.handler(event, context);
            } else {
                result = this.handler(event, context);
            }

            // 更新統計
            const processingTime = Date.now() - startTime;
            this.stats.invoked++;
            this.stats.lastInvocation = new Date().toISOString();
            this.stats.averageProcessingTime = (
                this.stats.averageProcessingTime * (this.stats.invoked - 1) + processingTime
            ) / this.stats.invoked;

            // 一次性訂閱自動取消
            if (this.options.once) {
                this.active = false;
            }

            return result;

        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }
}

/**
 * 事件批處理器
 */
class EventBatcher {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 100;
        this.batchTimeout = options.batchTimeout || 1000;
        this.batch = [];
        this.batchTimer = null;
        this.processor = options.processor || this._defaultProcessor;
    }

    add(event) {
        this.batch.push(event);

        if (this.batch.length >= this.batchSize) {
            this._processBatch();
        } else if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => {
                this._processBatch();
            }, this.batchTimeout);
        }
    }

    async _processBatch() {
        if (this.batch.length === 0) return;

        const currentBatch = this.batch.splice(0);

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        try {
            await this.processor(currentBatch);
        } catch (error) {
            console.error('批處理失敗:', error);
        }
    }

    async _defaultProcessor(events) {
        console.log(`處理批次: ${events.length} 個事件`);
    }

    async flush() {
        await this._processBatch();
    }

    dispose() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        this.batch.length = 0;
    }
}

/**
 * 主事件總線類
 */
class EventBus extends EventEmitter {
    constructor(options = {}) {
        super();
        this.setMaxListeners(10000); // 支持大量訂閱者

        this.options = {
            enablePersistence: options.enablePersistence !== false,
            enableMiddleware: options.enableMiddleware !== false,
            enableBatching: options.enableBatching || false,
            maxConcurrentEvents: options.maxConcurrentEvents || 1000,
            ...options
        };

        // 核心組件
        this.store = null;
        this.serializer = null;
        this.middleware = null;
        this.batcher = null;

        // 訂閱管理
        this.subscriptions = new Map(); // eventName -> Set<EventSubscription>
        this.globalSubscriptions = new Set(); // 全局訂閱者

        // 性能監控
        this.stats = {
            eventsPublished: 0,
            eventsProcessed: 0,
            subscriptionsActive: 0,
            errors: 0,
            averageLatency: 0
        };

        // 併發控制
        this.activeEvents = 0;
        this.eventQueue = [];
        this.processing = false;

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化事件總線
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // 初始化存儲
            if (this.options.enablePersistence) {
                this.store = new EventStore(this.options.store);
                await this.store.initialize();

                // 監聽存儲事件
                this.store.on('error', (error) => {
                    this.emit('storeError', error);
                });
            }

            // 初始化序列化器
            this.serializer = new EventSerializer(this.options.serializer);

            // 初始化中間件
            if (this.options.enableMiddleware) {
                this.middleware = new EventMiddleware(this.options.middleware);

                // 監聽中間件事件
                this.middleware.on('middlewareError', (error) => {
                    this.emit('middlewareError', error);
                });
            }

            // 初始化批處理器
            if (this.options.enableBatching) {
                this.batcher = new EventBatcher({
                    ...this.options.batching,
                    processor: this._processBatch.bind(this)
                });
            }

            this.initialized = true;
            this.emit('initialized');

        } catch (error) {
            this.emit('error', new Error(`EventBus初始化失敗: ${error.message}`));
            throw error;
        }
    }

    /**
     * 發布事件
     * @param {String} eventName - 事件名稱
     * @param {Object} data - 事件數據
     * @param {Object} options - 發布選項
     * @returns {Promise<String>} 事件ID
     */
    async publish(eventName, data = {}, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        try {
            // 創建事件對象
            const event = {
                id: this._generateEventId(),
                type: eventName,
                data,
                timestamp: new Date().toISOString(),
                source: options.source || 'unknown',
                priority: options.priority || 0,
                ...options.metadata
            };

            // 應用中間件處理
            let processedEvent = event;
            if (this.middleware) {
                const context = {
                    busInstance: this,
                    publishOptions: options
                };

                processedEvent = await this.middleware.execute(event, context);

                if (processedEvent === null) {
                    // 事件被中間件過濾
                    return null;
                }
            }

            // 持久化事件
            if (this.store && options.persist !== false) {
                await this.store.store(processedEvent);
            }

            // 批處理或直接分發
            if (this.batcher && options.batch !== false) {
                this.batcher.add({
                    event: processedEvent,
                    options,
                    timestamp: Date.now()
                });
            } else {
                await this._dispatchEvent(processedEvent, options);
            }

            // 更新統計
            this.stats.eventsPublished++;
            const latency = Date.now() - startTime;
            this.stats.averageLatency = (
                this.stats.averageLatency * (this.stats.eventsPublished - 1) + latency
            ) / this.stats.eventsPublished;

            this.emit('eventPublished', {
                eventId: event.id,
                eventName,
                latency
            });

            return event.id;

        } catch (error) {
            this.stats.errors++;
            this.emit('error', new Error(`發布事件失敗: ${error.message}`));
            throw error;
        }
    }

    /**
     * 訂閱事件
     * @param {String} eventName - 事件名稱，支持萬用字符
     * @param {Function} handler - 事件處理器
     * @param {Object} options - 訂閱選項
     * @returns {String} 訂閱ID
     */
    subscribe(eventName, handler, options = {}) {
        if (typeof handler !== 'function') {
            throw new Error('事件處理器必須是函數');
        }

        const subscription = new EventSubscription(eventName, handler, options);

        if (eventName === '*') {
            // 全局訂閱
            this.globalSubscriptions.add(subscription);
        } else {
            // 特定事件訂閱
            if (!this.subscriptions.has(eventName)) {
                this.subscriptions.set(eventName, new Set());
            }
            this.subscriptions.get(eventName).add(subscription);
        }

        this.stats.subscriptionsActive++;

        this.emit('subscriptionAdded', {
            subscriptionId: subscription.id,
            eventName,
            options
        });

        return subscription.id;
    }

    /**
     * 取消訂閱
     * @param {String} subscriptionId - 訂閱ID
     * @returns {Boolean} 是否成功取消
     */
    unsubscribe(subscriptionId) {
        // 搜尋並移除訂閱
        for (const [eventName, subscriptionSet] of this.subscriptions.entries()) {
            for (const subscription of subscriptionSet) {
                if (subscription.id === subscriptionId) {
                    subscriptionSet.delete(subscription);
                    subscription.active = false;

                    if (subscriptionSet.size === 0) {
                        this.subscriptions.delete(eventName);
                    }

                    this.stats.subscriptionsActive--;

                    this.emit('subscriptionRemoved', {
                        subscriptionId,
                        eventName
                    });

                    return true;
                }
            }
        }

        // 檢查全局訂閱
        for (const subscription of this.globalSubscriptions) {
            if (subscription.id === subscriptionId) {
                this.globalSubscriptions.delete(subscription);
                subscription.active = false;
                this.stats.subscriptionsActive--;

                this.emit('subscriptionRemoved', {
                    subscriptionId,
                    eventName: '*'
                });

                return true;
            }
        }

        return false;
    }

    /**
     * 一次性訂閱
     * @param {String} eventName - 事件名稱
     * @param {Function} handler - 事件處理器
     * @param {Object} options - 訂閱選項
     * @returns {Promise} 事件Promise
     */
    once(eventName, handler, options = {}) {
        return new Promise((resolve, reject) => {
            const wrappedHandler = async (event, context) => {
                try {
                    const result = await handler(event, context);
                    resolve(result);
                    return result;
                } catch (error) {
                    reject(error);
                    throw error;
                }
            };

            this.subscribe(eventName, wrappedHandler, {
                ...options,
                once: true
            });
        });
    }

    /**
     * 等待特定事件
     * @param {String} eventName - 事件名稱
     * @param {Object} options - 等待選項
     * @returns {Promise<Object>} 事件對象
     */
    waitFor(eventName, options = {}) {
        const { timeout, filter } = options;

        return new Promise((resolve, reject) => {
            let timeoutHandle = null;

            if (timeout) {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`等待事件超時: ${eventName}`));
                }, timeout);
            }

            const subscription = this.subscribe(eventName, async (event) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }

                resolve(event);
            }, {
                once: true,
                filter
            });
        });
    }

    /**
     * 事件回放
     * @param {Object} options - 回放選項
     * @param {Function} callback - 事件處理回調
     * @returns {Promise<void>}
     */
    async replay(options = {}, callback) {
        if (!this.store) {
            throw new Error('事件回放需要啟用持久化存儲');
        }

        await this.store.replay(options, callback);
    }

    /**
     * 獲取訂閱統計
     * @returns {Object} 統計信息
     */
    getSubscriptionStats() {
        const stats = {};

        for (const [eventName, subscriptions] of this.subscriptions.entries()) {
            stats[eventName] = {
                totalSubscriptions: subscriptions.size,
                subscriptions: Array.from(subscriptions).map(sub => ({
                    id: sub.id,
                    stats: sub.stats,
                    active: sub.active
                }))
            };
        }

        stats['*'] = {
            totalSubscriptions: this.globalSubscriptions.size,
            subscriptions: Array.from(this.globalSubscriptions).map(sub => ({
                id: sub.id,
                stats: sub.stats,
                active: sub.active
            }))
        };

        return stats;
    }

    /**
     * 獲取總統計信息
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            store: this.store ? this.store.getStats() : null,
            serializer: this.serializer ? this.serializer.getStats() : null,
            middleware: this.middleware ? this.middleware.getStats() : null,
            subscriptions: this.getSubscriptionStats()
        };
    }

    // 私有方法

    /**
     * 分發事件到訂閱者
     * @private
     */
    async _dispatchEvent(event, options = {}) {
        const { eventName, priority = 0 } = event;

        // 並發控制
        if (this.activeEvents >= this.options.maxConcurrentEvents) {
            this.eventQueue.push({ event, options });
            return;
        }

        this.activeEvents++;

        try {
            const subscriptions = [];

            // 收集特定事件訂閱者
            if (this.subscriptions.has(event.type)) {
                subscriptions.push(...this.subscriptions.get(event.type));
            }

            // 收集全局訂閱者
            subscriptions.push(...this.globalSubscriptions);

            // 按優先級排序
            subscriptions.sort((a, b) => b.options.priority - a.options.priority);

            // 並行或序列執行
            if (options.sequential) {
                // 序列執行
                for (const subscription of subscriptions) {
                    try {
                        await subscription.invoke(event, { busInstance: this });
                    } catch (error) {
                        this.emit('subscriptionError', {
                            subscription: subscription.id,
                            event: event.id,
                            error
                        });
                    }
                }
            } else {
                // 並行執行
                const promises = subscriptions.map(async (subscription) => {
                    try {
                        return await subscription.invoke(event, { busInstance: this });
                    } catch (error) {
                        this.emit('subscriptionError', {
                            subscription: subscription.id,
                            event: event.id,
                            error
                        });
                        throw error;
                    }
                });

                await Promise.allSettled(promises);
            }

            // 清理一次性訂閱
            this._cleanupInactiveSubscriptions();

            this.stats.eventsProcessed++;

        } finally {
            this.activeEvents--;

            // 處理佇列中的事件
            if (this.eventQueue.length > 0) {
                const queued = this.eventQueue.shift();
                setImmediate(() => {
                    this._dispatchEvent(queued.event, queued.options);
                });
            }
        }
    }

    /**
     * 處理批次事件
     * @private
     */
    async _processBatch(batchItems) {
        for (const item of batchItems) {
            await this._dispatchEvent(item.event, item.options);
        }
    }

    /**
     * 清理非活動訂閱
     * @private
     */
    _cleanupInactiveSubscriptions() {
        for (const [eventName, subscriptionSet] of this.subscriptions.entries()) {
            const inactiveSubscriptions = Array.from(subscriptionSet).filter(sub => !sub.active);

            for (const subscription of inactiveSubscriptions) {
                subscriptionSet.delete(subscription);
                this.stats.subscriptionsActive--;
            }

            if (subscriptionSet.size === 0) {
                this.subscriptions.delete(eventName);
            }
        }

        // 清理全局訂閱
        const inactiveGlobal = Array.from(this.globalSubscriptions).filter(sub => !sub.active);
        for (const subscription of inactiveGlobal) {
            this.globalSubscriptions.delete(subscription);
            this.stats.subscriptionsActive--;
        }
    }

    /**
     * 生成事件ID
     * @private
     */
    _generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 清理資源
     */
    async dispose() {
        // 清理批處理器
        if (this.batcher) {
            await this.batcher.flush();
            this.batcher.dispose();
        }

        // 清理訂閱
        this.subscriptions.clear();
        this.globalSubscriptions.clear();

        // 清理組件
        if (this.store) {
            await this.store.dispose();
        }

        if (this.serializer) {
            this.serializer.dispose();
        }

        if (this.middleware) {
            this.middleware.dispose();
        }

        this.removeAllListeners();
    }
}

module.exports = EventBus;