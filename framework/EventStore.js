/**
 * EventStore - 事件持久化存儲系統
 *
 * 功能：
 * - 事件持久化存儲到文件系統
 * - 事件查詢和過濾功能
 * - 事件回放和歷史查詢
 * - 事件版本控制和遷移
 *
 * 用途：為EventBus提供可靠的事件持久化和查詢服務
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const EventSerializer = require('./EventSerializer');

class EventStore extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            storePath: options.storePath || path.join(process.cwd(), '.claude', 'data', 'events'),
            maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
            maxFiles: options.maxFiles || 100,
            indexingEnabled: options.indexingEnabled !== false,
            compressionEnabled: options.compressionEnabled || true,
            version: options.version || '1.0',
            ...options
        };

        this.serializer = new EventSerializer({
            enableCompression: this.options.compressionEnabled,
            enableEncryption: this.options.encryptionEnabled,
            encryptionKey: this.options.encryptionKey
        });

        // 內存索引，用於快速查詢
        this.eventIndex = new Map(); // eventId -> fileInfo
        this.typeIndex = new Map();  // eventType -> Set<eventId>
        this.timeIndex = new Map();  // timestamp -> Set<eventId>

        // 當前寫入文件信息
        this.currentFile = null;
        this.currentFileSize = 0;
        this.fileSequence = 0;

        // 統計信息
        this.stats = {
            eventsStored: 0,
            eventsRetrieved: 0,
            filesCreated: 0,
            indexHits: 0,
            errors: 0
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化事件存儲
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // 確保存儲目錄存在
            await fs.mkdir(this.options.storePath, { recursive: true });

            // 載入現有文件和索引
            await this._loadExistingFiles();
            await this._buildIndex();

            this.initialized = true;
            this.emit('initialized');

        } catch (error) {
            this.emit('error', new Error(`EventStore初始化失敗: ${error.message}`));
            throw error;
        }
    }

    /**
     * 存儲事件
     * @param {Object} event - 要存儲的事件對象
     * @returns {Promise<String>} 事件ID
     */
    async store(event) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // 生成事件ID
            const eventId = this._generateEventId(event);

            // 添加存儲元數據
            const eventWithMeta = {
                ...event,
                id: eventId,
                storedAt: new Date().toISOString(),
                version: this.options.version
            };

            // 序列化事件
            const serializedEvent = await this.serializer.serialize(eventWithMeta);

            // 檢查是否需要創建新文件
            await this._ensureCurrentFile();

            // 寫入事件到文件
            const fileInfo = await this._writeEventToFile(eventId, serializedEvent);

            // 更新索引
            this._updateIndexes(eventId, eventWithMeta, fileInfo);

            // 更新統計
            this.stats.eventsStored++;

            this.emit('eventStored', { eventId, event: eventWithMeta });

            return eventId;

        } catch (error) {
            this.stats.errors++;
            this.emit('error', new Error(`存儲事件失敗: ${error.message}`));
            throw error;
        }
    }

    /**
     * 根據ID檢索事件
     * @param {String} eventId - 事件ID
     * @returns {Promise<Object|null>} 事件對象或null
     */
    async retrieve(eventId) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // 查找事件文件信息
            const fileInfo = this.eventIndex.get(eventId);
            if (!fileInfo) {
                return null;
            }

            this.stats.indexHits++;

            // 從文件讀取事件
            const serializedEvent = await this._readEventFromFile(eventId, fileInfo);
            const event = await this.serializer.deserialize(serializedEvent);

            this.stats.eventsRetrieved++;

            return event;

        } catch (error) {
            this.stats.errors++;
            this.emit('error', new Error(`檢索事件失敗: ${error.message}`));
            throw error;
        }
    }

    /**
     * 查詢事件
     * @param {Object} filter - 查詢過濾條件
     * @returns {Promise<Array<Object>>} 匹配的事件列表
     */
    async query(filter = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const {
                type,
                startTime,
                endTime,
                limit = 1000,
                offset = 0,
                sortBy = 'timestamp',
                sortOrder = 'desc'
            } = filter;

            let candidateIds = new Set();

            // 根據事件類型過濾
            if (type) {
                const typeIds = this.typeIndex.get(type);
                if (typeIds) {
                    candidateIds = new Set(typeIds);
                } else {
                    return [];
                }
            } else {
                // 獲取所有事件ID
                candidateIds = new Set(this.eventIndex.keys());
            }

            // 根據時間範圍過濾
            if (startTime || endTime) {
                candidateIds = this._filterByTimeRange(candidateIds, startTime, endTime);
            }

            // 轉換為數組並排序
            const sortedIds = Array.from(candidateIds);

            // 這裡簡化排序，實際實施中可能需要更複雜的排序邏輯
            if (sortBy === 'timestamp') {
                sortedIds.sort((a, b) => {
                    const timeA = this._extractTimestampFromId(a);
                    const timeB = this._extractTimestampFromId(b);
                    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
                });
            }

            // 應用分頁
            const paginatedIds = sortedIds.slice(offset, offset + limit);

            // 並行檢索事件
            const events = await Promise.all(
                paginatedIds.map(id => this.retrieve(id))
            );

            return events.filter(event => event !== null);

        } catch (error) {
            this.stats.errors++;
            this.emit('error', new Error(`查詢事件失敗: ${error.message}`));
            throw error;
        }
    }

    /**
     * 事件回放
     * @param {Object} options - 回放選項
     * @param {Function} callback - 事件處理回調
     * @returns {Promise<void>}
     */
    async replay(options = {}, callback) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const {
                startTime,
                endTime,
                eventTypes = [],
                speed = 1.0, // 回放速度倍數
                realTime = false // 是否按實際時間間隔回放
            } = options;

            // 查詢事件
            const events = await this.query({
                startTime,
                endTime,
                type: eventTypes.length > 0 ? eventTypes[0] : undefined,
                sortBy: 'timestamp',
                sortOrder: 'asc',
                limit: 10000
            });

            this.emit('replayStarted', { eventCount: events.length });

            let previousTime = null;

            for (let i = 0; i < events.length; i++) {
                const event = events[i];

                // 過濾事件類型
                if (eventTypes.length > 0 && !eventTypes.includes(event.type)) {
                    continue;
                }

                // 計算回放延遲
                if (realTime && previousTime) {
                    const currentTime = new Date(event.timestamp).getTime();
                    const delay = (currentTime - previousTime) / speed;

                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                previousTime = new Date(event.timestamp).getTime();

                // 執行回調
                const shouldContinue = await callback(event, i, events.length);

                if (shouldContinue === false) {
                    break;
                }

                this.emit('replayProgress', {
                    processed: i + 1,
                    total: events.length,
                    progress: ((i + 1) / events.length * 100).toFixed(2)
                });
            }

            this.emit('replayCompleted');

        } catch (error) {
            this.stats.errors++;
            this.emit('error', new Error(`事件回放失敗: ${error.message}`));
            throw error;
        }
    }

    /**
     * 清理舊事件
     * @param {Object} options - 清理選項
     * @returns {Promise<Number>} 清理的事件數量
     */
    async cleanup(options = {}) {
        const {
            olderThan,
            keepLastN,
            eventTypes = []
        } = options;

        try {
            let deletedCount = 0;

            if (olderThan) {
                // 根據時間清理
                const cutoffTime = new Date(olderThan);
                const eventIds = Array.from(this.eventIndex.keys());

                for (const eventId of eventIds) {
                    const timestamp = this._extractTimestampFromId(eventId);
                    if (timestamp < cutoffTime.getTime()) {
                        await this._deleteEvent(eventId);
                        deletedCount++;
                    }
                }
            }

            if (keepLastN) {
                // 保留最新N個事件
                const allEvents = await this.query({
                    sortBy: 'timestamp',
                    sortOrder: 'desc'
                });

                if (allEvents.length > keepLastN) {
                    const eventsToDelete = allEvents.slice(keepLastN);

                    for (const event of eventsToDelete) {
                        await this._deleteEvent(event.id);
                        deletedCount++;
                    }
                }
            }

            this.emit('cleanupCompleted', { deletedCount });

            return deletedCount;

        } catch (error) {
            this.emit('error', new Error(`清理事件失敗: ${error.message}`));
            throw error;
        }
    }

    /**
     * 獲取統計信息
     * @returns {Object} 統計信息
     */
    getStats() {
        return {
            ...this.stats,
            totalEvents: this.eventIndex.size,
            totalTypes: this.typeIndex.size,
            indexEfficiency: this.stats.indexHits / this.stats.eventsRetrieved || 0,
            serializer: this.serializer.getStats()
        };
    }

    // 私有方法

    /**
     * 載入現有文件
     * @private
     */
    async _loadExistingFiles() {
        try {
            const files = await fs.readdir(this.options.storePath);
            const eventFiles = files.filter(f => f.startsWith('events_') && f.endsWith('.json'));

            // 確定下一個文件序號
            if (eventFiles.length > 0) {
                const sequences = eventFiles.map(f => {
                    const match = f.match(/events_(\d+)\.json/);
                    return match ? parseInt(match[1]) : 0;
                });
                this.fileSequence = Math.max(...sequences) + 1;
            }

            this.stats.filesCreated = eventFiles.length;

        } catch (error) {
            // 目錄不存在是正常的，會在初始化時創建
        }
    }

    /**
     * 建立索引
     * @private
     */
    async _buildIndex() {
        try {
            const files = await fs.readdir(this.options.storePath);
            const eventFiles = files.filter(f => f.startsWith('events_') && f.endsWith('.json'));

            for (const file of eventFiles) {
                await this._indexFile(file);
            }

        } catch (error) {
            console.warn('建立索引時出錯:', error.message);
        }
    }

    /**
     * 索引文件
     * @private
     */
    async _indexFile(filename) {
        const filePath = path.join(this.options.storePath, filename);

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());

            for (let i = 0; i < lines.length; i++) {
                try {
                    const eventData = JSON.parse(lines[i]);
                    const event = await this.serializer.deserialize(eventData.data);

                    const fileInfo = {
                        filename,
                        lineNumber: i + 1
                    };

                    this._updateIndexes(event.id, event, fileInfo);

                } catch (parseError) {
                    console.warn(`解析事件失敗 ${filename}:${i + 1}`, parseError.message);
                }
            }

        } catch (error) {
            console.warn(`索引文件失敗 ${filename}:`, error.message);
        }
    }

    /**
     * 確保當前文件存在
     * @private
     */
    async _ensureCurrentFile() {
        if (!this.currentFile || this.currentFileSize >= this.options.maxFileSize) {
            this.currentFile = `events_${this.fileSequence++}.json`;
            this.currentFileSize = 0;
            this.stats.filesCreated++;
        }
    }

    /**
     * 寫入事件到文件
     * @private
     */
    async _writeEventToFile(eventId, serializedEvent) {
        const filePath = path.join(this.options.storePath, this.currentFile);

        const eventEntry = {
            id: eventId,
            data: serializedEvent,
            timestamp: new Date().toISOString()
        };

        const line = JSON.stringify(eventEntry) + '\n';

        await fs.appendFile(filePath, line, 'utf8');
        this.currentFileSize += line.length;

        return {
            filename: this.currentFile,
            lineNumber: await this._getFileLineCount(filePath)
        };
    }

    /**
     * 從文件讀取事件
     * @private
     */
    async _readEventFromFile(eventId, fileInfo) {
        const filePath = path.join(this.options.storePath, fileInfo.filename);

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');

            if (fileInfo.lineNumber <= lines.length) {
                const line = lines[fileInfo.lineNumber - 1];
                const eventEntry = JSON.parse(line);

                if (eventEntry.id === eventId) {
                    return eventEntry.data;
                }
            }

            throw new Error(`事件未找到: ${eventId}`);

        } catch (error) {
            throw new Error(`讀取事件失敗: ${error.message}`);
        }
    }

    /**
     * 更新索引
     * @private
     */
    _updateIndexes(eventId, event, fileInfo) {
        // 更新主索引
        this.eventIndex.set(eventId, fileInfo);

        // 更新類型索引
        if (!this.typeIndex.has(event.type)) {
            this.typeIndex.set(event.type, new Set());
        }
        this.typeIndex.get(event.type).add(eventId);

        // 更新時間索引
        const timestamp = new Date(event.timestamp).getTime();
        const timeKey = Math.floor(timestamp / (1000 * 60 * 60)); // 按小時分組

        if (!this.timeIndex.has(timeKey)) {
            this.timeIndex.set(timeKey, new Set());
        }
        this.timeIndex.get(timeKey).add(eventId);
    }

    /**
     * 生成事件ID
     * @private
     */
    _generateEventId(event) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `${timestamp}_${random}`;
    }

    /**
     * 從事件ID提取時間戳
     * @private
     */
    _extractTimestampFromId(eventId) {
        const parts = eventId.split('_');
        return parseInt(parts[0]) || 0;
    }

    /**
     * 根據時間範圍過濾事件ID
     * @private
     */
    _filterByTimeRange(candidateIds, startTime, endTime) {
        const filtered = new Set();

        for (const eventId of candidateIds) {
            const timestamp = this._extractTimestampFromId(eventId);

            if (startTime && timestamp < new Date(startTime).getTime()) {
                continue;
            }

            if (endTime && timestamp > new Date(endTime).getTime()) {
                continue;
            }

            filtered.add(eventId);
        }

        return filtered;
    }

    /**
     * 獲取文件行數
     * @private
     */
    async _getFileLineCount(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return content.split('\n').length;
        } catch (error) {
            return 1;
        }
    }

    /**
     * 刪除事件
     * @private
     */
    async _deleteEvent(eventId) {
        // 從索引中移除
        const fileInfo = this.eventIndex.get(eventId);
        if (fileInfo) {
            this.eventIndex.delete(eventId);

            // 從類型索引中移除
            for (const [type, ids] of this.typeIndex.entries()) {
                if (ids.has(eventId)) {
                    ids.delete(eventId);
                    if (ids.size === 0) {
                        this.typeIndex.delete(type);
                    }
                }
            }

            // 從時間索引中移除
            for (const [timeKey, ids] of this.timeIndex.entries()) {
                if (ids.has(eventId)) {
                    ids.delete(eventId);
                    if (ids.size === 0) {
                        this.timeIndex.delete(timeKey);
                    }
                }
            }
        }
    }

    /**
     * 清理資源
     */
    async dispose() {
        this.eventIndex.clear();
        this.typeIndex.clear();
        this.timeIndex.clear();
        this.serializer.dispose();
        this.removeAllListeners();
    }
}

module.exports = EventStore;