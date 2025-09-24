/**
 * CommandHistory - 智能命令歷史管理系統
 *
 * 功能：
 * - 完整的命令執行歷史記錄和索引
 * - 智能搜索和過濾功能
 * - 命令重複執行和歷史導航
 * - 會話管理和持久化存儲
 * - 統計分析和使用模式識別
 *
 * 用途：提升整合命令接口的用戶體驗和工作效率
 * 配合：與IntegratedCommandInterface和CommandCompletion整合
 */

import EventEmitter from 'eventemitter3';

// 歷史記錄狀態
export const HISTORY_ENTRY_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// 搜索類型
export const SEARCH_TYPE = {
    COMMAND: 'command',         // 按命令名搜索
    PARAMETER: 'parameter',     // 按參數搜索
    RESULT: 'result',           // 按結果搜索
    DATE: 'date',               // 按日期範圍搜索
    STATUS: 'status',           // 按狀態搜索
    FULL_TEXT: 'fulltext'       // 全文搜索
};

// 排序方式
export const SORT_ORDER = {
    RECENT: 'recent',           // 最新優先
    OLDEST: 'oldest',           // 最舊優先
    FREQUENCY: 'frequency',     // 使用頻率
    SUCCESS_RATE: 'success_rate', // 成功率
    EXECUTION_TIME: 'execution_time', // 執行時間
    ALPHABETICAL: 'alphabetical' // 字母順序
};

/**
 * 歷史記錄項目
 */
class HistoryEntry {
    constructor(command, options = {}) {
        this.id = this._generateId();
        this.sessionId = options.sessionId || 'default';
        this.command = command.trim();
        this.timestamp = Date.now();
        this.status = HISTORY_ENTRY_STATUS.PENDING;

        // 命令解析信息
        this.parsedCommand = options.parsedCommand || null;
        this.commandType = options.commandType || '';
        this.parameters = options.parameters || {};
        this.flags = options.flags || {};

        // 執行信息
        this.startTime = null;
        this.endTime = null;
        this.executionTime = 0;
        this.retryCount = 0;

        // 結果信息
        this.result = null;
        this.error = null;
        this.exitCode = 0;
        this.outputSize = 0;

        // 上下文信息
        this.workingDirectory = options.workingDirectory || '';
        this.environment = options.environment || {};
        this.userAgent = options.userAgent || '';

        // 統計信息
        this.frequency = 0;        // 執行頻率
        this.lastExecuted = null;  // 最後執行時間
        this.successCount = 0;     // 成功次數
        this.failureCount = 0;     // 失敗次數

        // 標籤和分類
        this.tags = options.tags || [];
        this.category = options.category || 'general';
        this.importance = options.importance || 'normal'; // low, normal, high, critical

        // 用戶註解
        this.note = '';
        this.favorite = false;
        this.archived = false;
    }

    /**
     * 生成唯一ID
     * @private
     */
    _generateId() {
        return `hist_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 更新執行狀態
     * @param {string} status - 新狀態
     * @param {Object} data - 額外數據
     */
    updateStatus(status, data = {}) {
        this.status = status;

        switch (status) {
            case HISTORY_ENTRY_STATUS.RUNNING:
                this.startTime = Date.now();
                break;

            case HISTORY_ENTRY_STATUS.SUCCESS:
                this.endTime = Date.now();
                this.executionTime = this.endTime - (this.startTime || this.timestamp);
                this.result = data.result;
                this.outputSize = this._calculateOutputSize(data.result);
                this.successCount++;
                this.exitCode = 0;
                break;

            case HISTORY_ENTRY_STATUS.FAILED:
                this.endTime = Date.now();
                this.executionTime = this.endTime - (this.startTime || this.timestamp);
                this.error = data.error;
                this.failureCount++;
                this.exitCode = data.exitCode || 1;
                break;

            case HISTORY_ENTRY_STATUS.CANCELLED:
                this.endTime = Date.now();
                this.executionTime = this.endTime - (this.startTime || this.timestamp);
                this.exitCode = 130; // SIGINT
                break;
        }

        this.lastExecuted = Date.now();
        this.frequency++;
    }

    /**
     * 計算輸出大小
     * @private
     */
    _calculateOutputSize(result) {
        if (!result) return 0;

        try {
            return JSON.stringify(result).length;
        } catch {
            return String(result).length;
        }
    }

    /**
     * 計算成功率
     * @returns {number} 成功率 (0-1)
     */
    getSuccessRate() {
        const total = this.successCount + this.failureCount;
        return total > 0 ? this.successCount / total : 0;
    }

    /**
     * 獲取執行摘要
     * @returns {Object} 執行摘要
     */
    getSummary() {
        return {
            id: this.id,
            command: this.command,
            status: this.status,
            timestamp: this.timestamp,
            executionTime: this.executionTime,
            successRate: this.getSuccessRate(),
            frequency: this.frequency,
            tags: this.tags,
            favorite: this.favorite
        };
    }

    /**
     * 匹配搜索查詢
     * @param {string} query - 搜索查詢
     * @param {string} type - 搜索類型
     * @returns {boolean} 是否匹配
     */
    matches(query, type = SEARCH_TYPE.FULL_TEXT) {
        if (!query) return true;

        const queryLower = query.toLowerCase();

        switch (type) {
            case SEARCH_TYPE.COMMAND:
                return this.command.toLowerCase().includes(queryLower);

            case SEARCH_TYPE.PARAMETER:
                return Object.keys(this.parameters).some(key =>
                    key.toLowerCase().includes(queryLower) ||
                    String(this.parameters[key]).toLowerCase().includes(queryLower)
                );

            case SEARCH_TYPE.RESULT:
                return this.result &&
                       String(this.result).toLowerCase().includes(queryLower);

            case SEARCH_TYPE.STATUS:
                return this.status.toLowerCase().includes(queryLower);

            case SEARCH_TYPE.FULL_TEXT:
                return this.command.toLowerCase().includes(queryLower) ||
                       this.commandType.toLowerCase().includes(queryLower) ||
                       this.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
                       this.note.toLowerCase().includes(queryLower);

            default:
                return false;
        }
    }

    /**
     * 序列化為JSON
     * @returns {Object} JSON表示
     */
    toJSON() {
        return {
            id: this.id,
            sessionId: this.sessionId,
            command: this.command,
            timestamp: this.timestamp,
            status: this.status,
            parsedCommand: this.parsedCommand,
            commandType: this.commandType,
            parameters: this.parameters,
            flags: this.flags,
            startTime: this.startTime,
            endTime: this.endTime,
            executionTime: this.executionTime,
            retryCount: this.retryCount,
            result: this.result,
            error: this.error,
            exitCode: this.exitCode,
            outputSize: this.outputSize,
            workingDirectory: this.workingDirectory,
            environment: this.environment,
            userAgent: this.userAgent,
            frequency: this.frequency,
            lastExecuted: this.lastExecuted,
            successCount: this.successCount,
            failureCount: this.failureCount,
            tags: this.tags,
            category: this.category,
            importance: this.importance,
            note: this.note,
            favorite: this.favorite,
            archived: this.archived
        };
    }

    /**
     * 從JSON反序列化
     * @param {Object} data - JSON數據
     * @returns {HistoryEntry} 歷史記錄項目
     */
    static fromJSON(data) {
        const entry = new HistoryEntry(data.command, {
            sessionId: data.sessionId,
            parsedCommand: data.parsedCommand,
            commandType: data.commandType,
            parameters: data.parameters,
            flags: data.flags,
            workingDirectory: data.workingDirectory,
            environment: data.environment,
            userAgent: data.userAgent,
            tags: data.tags,
            category: data.category,
            importance: data.importance
        });

        // 恢復狀態
        Object.assign(entry, {
            id: data.id,
            timestamp: data.timestamp,
            status: data.status,
            startTime: data.startTime,
            endTime: data.endTime,
            executionTime: data.executionTime,
            retryCount: data.retryCount,
            result: data.result,
            error: data.error,
            exitCode: data.exitCode,
            outputSize: data.outputSize,
            frequency: data.frequency,
            lastExecuted: data.lastExecuted,
            successCount: data.successCount,
            failureCount: data.failureCount,
            note: data.note,
            favorite: data.favorite,
            archived: data.archived
        });

        return entry;
    }
}

/**
 * 歷史記錄索引器
 */
class HistoryIndexer {
    constructor() {
        this.commandIndex = new Map();      // 命令名 -> Set<entryId>
        this.parameterIndex = new Map();    // 參數名 -> Set<entryId>
        this.statusIndex = new Map();       // 狀態 -> Set<entryId>
        this.dateIndex = new Map();         // 日期 -> Set<entryId>
        this.tagIndex = new Map();          // 標籤 -> Set<entryId>
        this.categoryIndex = new Map();     // 類別 -> Set<entryId>
    }

    /**
     * 添加條目到索引
     * @param {HistoryEntry} entry - 歷史記錄條目
     */
    addEntry(entry) {
        // 命令索引
        this._addToIndex(this.commandIndex, entry.commandType, entry.id);

        // 參數索引
        Object.keys(entry.parameters).forEach(param => {
            this._addToIndex(this.parameterIndex, param, entry.id);
        });

        // 狀態索引
        this._addToIndex(this.statusIndex, entry.status, entry.id);

        // 日期索引 (按天分組)
        const dateKey = new Date(entry.timestamp).toDateString();
        this._addToIndex(this.dateIndex, dateKey, entry.id);

        // 標籤索引
        entry.tags.forEach(tag => {
            this._addToIndex(this.tagIndex, tag, entry.id);
        });

        // 類別索引
        this._addToIndex(this.categoryIndex, entry.category, entry.id);
    }

    /**
     * 從索引中移除條目
     * @param {HistoryEntry} entry - 歷史記錄條目
     */
    removeEntry(entry) {
        // 命令索引
        this._removeFromIndex(this.commandIndex, entry.commandType, entry.id);

        // 參數索引
        Object.keys(entry.parameters).forEach(param => {
            this._removeFromIndex(this.parameterIndex, param, entry.id);
        });

        // 狀態索引
        this._removeFromIndex(this.statusIndex, entry.status, entry.id);

        // 日期索引
        const dateKey = new Date(entry.timestamp).toDateString();
        this._removeFromIndex(this.dateIndex, dateKey, entry.id);

        // 標籤索引
        entry.tags.forEach(tag => {
            this._removeFromIndex(this.tagIndex, tag, entry.id);
        });

        // 類別索引
        this._removeFromIndex(this.categoryIndex, entry.category, entry.id);
    }

    /**
     * 搜索條目ID
     * @param {string} query - 搜索查詢
     * @param {string} type - 搜索類型
     * @returns {Set<string>} 匹配的條目ID集合
     */
    search(query, type = SEARCH_TYPE.FULL_TEXT) {
        const queryLower = query.toLowerCase();
        const results = new Set();

        switch (type) {
            case SEARCH_TYPE.COMMAND:
                for (const [command, ids] of this.commandIndex) {
                    if (command.toLowerCase().includes(queryLower)) {
                        ids.forEach(id => results.add(id));
                    }
                }
                break;

            case SEARCH_TYPE.PARAMETER:
                for (const [param, ids] of this.parameterIndex) {
                    if (param.toLowerCase().includes(queryLower)) {
                        ids.forEach(id => results.add(id));
                    }
                }
                break;

            case SEARCH_TYPE.STATUS:
                for (const [status, ids] of this.statusIndex) {
                    if (status.toLowerCase().includes(queryLower)) {
                        ids.forEach(id => results.add(id));
                    }
                }
                break;

            case SEARCH_TYPE.DATE:
                // 日期搜索需要特殊處理
                const targetDate = new Date(query).toDateString();
                const dateIds = this.dateIndex.get(targetDate);
                if (dateIds) {
                    dateIds.forEach(id => results.add(id));
                }
                break;

            case SEARCH_TYPE.FULL_TEXT:
                // 合併所有索引的結果
                [this.commandIndex, this.parameterIndex, this.tagIndex].forEach(index => {
                    for (const [key, ids] of index) {
                        if (key.toLowerCase().includes(queryLower)) {
                            ids.forEach(id => results.add(id));
                        }
                    }
                });
                break;
        }

        return results;
    }

    /**
     * 獲取統計信息
     * @returns {Object} 統計信息
     */
    getStatistics() {
        return {
            totalCommands: this.commandIndex.size,
            totalParameters: this.parameterIndex.size,
            totalStatuses: this.statusIndex.size,
            totalTags: this.tagIndex.size,
            totalCategories: this.categoryIndex.size,
            entriesPerDay: Array.from(this.dateIndex.entries())
                .map(([date, ids]) => ({ date, count: ids.size }))
        };
    }

    /**
     * 添加到索引
     * @private
     */
    _addToIndex(index, key, entryId) {
        if (!index.has(key)) {
            index.set(key, new Set());
        }
        index.get(key).add(entryId);
    }

    /**
     * 從索引移除
     * @private
     */
    _removeFromIndex(index, key, entryId) {
        const ids = index.get(key);
        if (ids) {
            ids.delete(entryId);
            if (ids.size === 0) {
                index.delete(key);
            }
        }
    }

    /**
     * 清理索引
     */
    clear() {
        this.commandIndex.clear();
        this.parameterIndex.clear();
        this.statusIndex.clear();
        this.dateIndex.clear();
        this.tagIndex.clear();
        this.categoryIndex.clear();
    }
}

/**
 * 命令歷史管理系統主類
 */
export class CommandHistory extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            maxHistorySize: 10000,          // 最大歷史記錄數量
            sessionTimeout: 3600000,        // 1小時會話超時
            autoSave: true,                 // 自動保存
            saveInterval: 300000,           // 5分鐘保存間隔
            enableIndexing: true,           // 啟用索引
            enablePersistence: true,        // 啟用持久化
            enableCompression: false,       // 啟用壓縮
            enableEncryption: false,        // 啟用加密
            storageLocation: options.storageLocation || '.command_history.json',
            ...options
        };

        // 核心存儲
        this.entries = new Map();          // entryId -> HistoryEntry
        this.sessions = new Map();         // sessionId -> Session
        this.currentSessionId = this._generateSessionId();

        // 索引系統
        this.indexer = new HistoryIndexer();

        // 統計信息
        this.stats = {
            totalCommands: 0,
            totalSessions: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            successRate: 0,
            mostUsedCommands: [],
            recentActivity: []
        };

        // 自動保存定時器
        this.saveTimer = null;

        // 初始化狀態
        this.initialized = false;
        this.currentPosition = -1; // 歷史導航位置
        this.navigationHistory = []; // 導航歷史
    }

    /**
     * 初始化命令歷史系統
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('[CommandHistory] 初始化命令歷史系統...');

            // 創建當前會話
            this._createSession(this.currentSessionId);

            // 從持久存儲載入歷史
            if (this.options.enablePersistence) {
                await this._loadFromStorage();
            }

            // 重建索引
            if (this.options.enableIndexing) {
                this._rebuildIndexes();
            }

            // 啟動自動保存
            if (this.options.autoSave) {
                this._startAutoSave();
            }

            // 清理過期會話
            this._cleanupExpiredSessions();

            this.initialized = true;
            console.log(`[CommandHistory] 命令歷史系統初始化完成，載入 ${this.entries.size} 條記錄`);
            this.emit('initialized', { entriesCount: this.entries.size });

        } catch (error) {
            console.error('[CommandHistory] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 添加命令到歷史
     * @param {string} command - 命令字符串
     * @param {Object} options - 選項
     * @returns {HistoryEntry} 歷史記錄項目
     */
    addEntry(command, options = {}) {
        if (!this.initialized) {
            throw new Error('命令歷史系統未初始化');
        }

        // 創建歷史記錄項目
        const entry = new HistoryEntry(command, {
            sessionId: this.currentSessionId,
            ...options
        });

        // 檢查是否需要合併重複命令
        const existingEntry = this._findDuplicateEntry(command);
        if (existingEntry && this.options.mergeDuplicates) {
            existingEntry.frequency++;
            existingEntry.lastExecuted = Date.now();
            return existingEntry;
        }

        // 添加到存儲
        this.entries.set(entry.id, entry);

        // 更新索引
        if (this.options.enableIndexing) {
            this.indexer.addEntry(entry);
        }

        // 更新會話
        const session = this.sessions.get(this.currentSessionId);
        if (session) {
            session.entries.push(entry.id);
            session.lastActivity = Date.now();
        }

        // 更新統計
        this._updateStatistics();

        // 檢查存儲限制
        this._enforceStorageLimit();

        // 重置導航位置
        this.currentPosition = -1;
        this.navigationHistory = Array.from(this.entries.keys()).reverse();

        // 發送事件
        this.emit('entryAdded', entry);

        console.log(`[CommandHistory] 添加命令歷史: ${command}`);
        return entry;
    }

    /**
     * 更新條目狀態
     * @param {string} entryId - 條目ID
     * @param {string} status - 新狀態
     * @param {Object} data - 額外數據
     */
    updateEntry(entryId, status, data = {}) {
        const entry = this.entries.get(entryId);
        if (!entry) {
            console.warn(`[CommandHistory] 找不到歷史記錄: ${entryId}`);
            return;
        }

        entry.updateStatus(status, data);
        this._updateStatistics();

        this.emit('entryUpdated', entry);
        console.log(`[CommandHistory] 更新命令狀態: ${entryId} -> ${status}`);
    }

    /**
     * 搜索歷史記錄
     * @param {string} query - 搜索查詢
     * @param {Object} options - 搜索選項
     * @returns {Array<HistoryEntry>} 搜索結果
     */
    search(query, options = {}) {
        const {
            type = SEARCH_TYPE.FULL_TEXT,
            limit = 100,
            sortBy = SORT_ORDER.RECENT,
            includeArchived = false,
            sessionId = null
        } = options;

        let results = [];

        if (this.options.enableIndexing && query) {
            // 使用索引搜索
            const entryIds = this.indexer.search(query, type);
            results = Array.from(entryIds)
                .map(id => this.entries.get(id))
                .filter(entry => entry);
        } else {
            // 線性搜索
            results = Array.from(this.entries.values())
                .filter(entry => !query || entry.matches(query, type));
        }

        // 應用過濾器
        results = results.filter(entry => {
            if (!includeArchived && entry.archived) return false;
            if (sessionId && entry.sessionId !== sessionId) return false;
            return true;
        });

        // 排序
        results = this._sortResults(results, sortBy);

        // 限制數量
        results = results.slice(0, limit);

        console.log(`[CommandHistory] 搜索 "${query}" 找到 ${results.length} 條記錄`);
        return results;
    }

    /**
     * 獲取最近的命令
     * @param {number} limit - 限制數量
     * @param {Object} filters - 過濾器
     * @returns {Array<HistoryEntry>} 最近命令列表
     */
    getRecentCommands(limit = 20, filters = {}) {
        return this.search('', {
            limit,
            sortBy: SORT_ORDER.RECENT,
            ...filters
        });
    }

    /**
     * 獲取常用命令
     * @param {number} limit - 限制數量
     * @returns {Array<HistoryEntry>} 常用命令列表
     */
    getFrequentCommands(limit = 10) {
        return this.search('', {
            limit,
            sortBy: SORT_ORDER.FREQUENCY
        });
    }

    /**
     * 獲取收藏命令
     * @returns {Array<HistoryEntry>} 收藏命令列表
     */
    getFavoriteCommands() {
        return Array.from(this.entries.values())
            .filter(entry => entry.favorite && !entry.archived)
            .sort((a, b) => b.lastExecuted - a.lastExecuted);
    }

    /**
     * 歷史導航 - 上一條命令
     * @returns {HistoryEntry|null} 上一條命令
     */
    navigatePrevious() {
        if (this.navigationHistory.length === 0) return null;

        this.currentPosition = Math.min(
            this.currentPosition + 1,
            this.navigationHistory.length - 1
        );

        const entryId = this.navigationHistory[this.currentPosition];
        return this.entries.get(entryId) || null;
    }

    /**
     * 歷史導航 - 下一條命令
     * @returns {HistoryEntry|null} 下一條命令
     */
    navigateNext() {
        if (this.navigationHistory.length === 0 || this.currentPosition <= 0) {
            this.currentPosition = -1;
            return null;
        }

        this.currentPosition--;
        const entryId = this.navigationHistory[this.currentPosition];
        return this.entries.get(entryId) || null;
    }

    /**
     * 重置導航位置
     */
    resetNavigation() {
        this.currentPosition = -1;
        this.navigationHistory = Array.from(this.entries.keys()).reverse();
    }

    /**
     * 標記條目為收藏
     * @param {string} entryId - 條目ID
     * @param {boolean} favorite - 是否收藏
     */
    setFavorite(entryId, favorite = true) {
        const entry = this.entries.get(entryId);
        if (entry) {
            entry.favorite = favorite;
            this.emit('favoriteChanged', { entryId, favorite });
        }
    }

    /**
     * 歸檔條目
     * @param {string} entryId - 條目ID
     * @param {boolean} archived - 是否歸檔
     */
    setArchived(entryId, archived = true) {
        const entry = this.entries.get(entryId);
        if (entry) {
            entry.archived = archived;
            this.emit('archiveChanged', { entryId, archived });
        }
    }

    /**
     * 添加標籤
     * @param {string} entryId - 條目ID
     * @param {Array<string>} tags - 標籤列表
     */
    addTags(entryId, tags) {
        const entry = this.entries.get(entryId);
        if (entry) {
            tags.forEach(tag => {
                if (!entry.tags.includes(tag)) {
                    entry.tags.push(tag);
                }
            });

            // 更新索引
            if (this.options.enableIndexing) {
                this.indexer.removeEntry(entry);
                this.indexer.addEntry(entry);
            }

            this.emit('tagsChanged', { entryId, tags: entry.tags });
        }
    }

    /**
     * 移除標籤
     * @param {string} entryId - 條目ID
     * @param {Array<string>} tags - 要移除的標籤
     */
    removeTags(entryId, tags) {
        const entry = this.entries.get(entryId);
        if (entry) {
            entry.tags = entry.tags.filter(tag => !tags.includes(tag));

            // 更新索引
            if (this.options.enableIndexing) {
                this.indexer.removeEntry(entry);
                this.indexer.addEntry(entry);
            }

            this.emit('tagsChanged', { entryId, tags: entry.tags });
        }
    }

    /**
     * 設置條目註解
     * @param {string} entryId - 條目ID
     * @param {string} note - 註解內容
     */
    setNote(entryId, note) {
        const entry = this.entries.get(entryId);
        if (entry) {
            entry.note = note;
            this.emit('noteChanged', { entryId, note });
        }
    }

    /**
     * 刪除條目
     * @param {string} entryId - 條目ID
     * @returns {boolean} 是否成功刪除
     */
    deleteEntry(entryId) {
        const entry = this.entries.get(entryId);
        if (!entry) return false;

        // 從索引移除
        if (this.options.enableIndexing) {
            this.indexer.removeEntry(entry);
        }

        // 從會話移除
        const session = this.sessions.get(entry.sessionId);
        if (session) {
            const index = session.entries.indexOf(entryId);
            if (index > -1) {
                session.entries.splice(index, 1);
            }
        }

        // 從存儲移除
        this.entries.delete(entryId);

        // 更新導航歷史
        this.navigationHistory = this.navigationHistory.filter(id => id !== entryId);

        // 更新統計
        this._updateStatistics();

        this.emit('entryDeleted', entryId);
        console.log(`[CommandHistory] 刪除歷史記錄: ${entryId}`);

        return true;
    }

    /**
     * 清理歷史記錄
     * @param {Object} criteria - 清理條件
     */
    cleanup(criteria = {}) {
        const {
            olderThan = null,           // 刪除指定時間之前的記錄
            status = null,              // 刪除特定狀態的記錄
            maxCount = null,            // 保留最多指定數量的記錄
            keepFavorites = true,       // 保留收藏項目
            keepRecent = 100           // 保留最近的指定數量
        } = criteria;

        let entriesToDelete = [];
        const now = Date.now();

        // 收集要刪除的條目
        for (const entry of this.entries.values()) {
            // 保護收藏項目
            if (keepFavorites && entry.favorite) continue;

            // 按時間過濾
            if (olderThan && (now - entry.timestamp) < olderThan) continue;

            // 按狀態過濾
            if (status && entry.status !== status) continue;

            entriesToDelete.push(entry);
        }

        // 保留最近的記錄
        if (keepRecent > 0) {
            const recent = this.getRecentCommands(keepRecent);
            const recentIds = new Set(recent.map(e => e.id));
            entriesToDelete = entriesToDelete.filter(e => !recentIds.has(e.id));
        }

        // 按數量限制
        if (maxCount && this.entries.size > maxCount) {
            const excess = this.entries.size - maxCount;
            const oldestFirst = Array.from(this.entries.values())
                .sort((a, b) => a.timestamp - b.timestamp);
            entriesToDelete = oldestFirst.slice(0, excess);
        }

        // 執行刪除
        let deletedCount = 0;
        for (const entry of entriesToDelete) {
            if (this.deleteEntry(entry.id)) {
                deletedCount++;
            }
        }

        console.log(`[CommandHistory] 清理完成，刪除 ${deletedCount} 條記錄`);
        this.emit('cleanupCompleted', { deletedCount });

        return deletedCount;
    }

    /**
     * 導出歷史記錄
     * @param {Object} options - 導出選項
     * @returns {Object} 導出數據
     */
    export(options = {}) {
        const {
            format = 'json',            // json, csv, txt
            includeArchived = false,
            sessionId = null,
            dateRange = null
        } = options;

        let entries = Array.from(this.entries.values());

        // 應用過濾器
        entries = entries.filter(entry => {
            if (!includeArchived && entry.archived) return false;
            if (sessionId && entry.sessionId !== sessionId) return false;
            if (dateRange) {
                const entryDate = entry.timestamp;
                if (entryDate < dateRange.start || entryDate > dateRange.end) return false;
            }
            return true;
        });

        switch (format) {
            case 'json':
                return {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    totalEntries: entries.length,
                    entries: entries.map(e => e.toJSON())
                };

            case 'csv':
                return this._exportToCSV(entries);

            case 'txt':
                return this._exportToText(entries);

            default:
                throw new Error(`不支持的導出格式: ${format}`);
        }
    }

    /**
     * 導入歷史記錄
     * @param {Object} data - 導入數據
     * @param {Object} options - 導入選項
     */
    import(data, options = {}) {
        const {
            merge = true,               // 合併模式，否則替換
            validateEntries = true      // 驗證條目
        } = options;

        if (!merge) {
            this.clear();
        }

        let importedCount = 0;
        let errorCount = 0;

        if (data.entries && Array.isArray(data.entries)) {
            for (const entryData of data.entries) {
                try {
                    if (validateEntries && !this._validateEntryData(entryData)) {
                        errorCount++;
                        continue;
                    }

                    const entry = HistoryEntry.fromJSON(entryData);

                    // 檢查是否已存在
                    if (!this.entries.has(entry.id) || !merge) {
                        this.entries.set(entry.id, entry);

                        // 更新索引
                        if (this.options.enableIndexing) {
                            this.indexer.addEntry(entry);
                        }

                        importedCount++;
                    }

                } catch (error) {
                    console.error('[CommandHistory] 導入條目失敗:', error);
                    errorCount++;
                }
            }
        }

        // 更新統計
        this._updateStatistics();

        console.log(`[CommandHistory] 導入完成: ${importedCount} 成功, ${errorCount} 失敗`);
        this.emit('importCompleted', { importedCount, errorCount });

        return { importedCount, errorCount };
    }

    /**
     * 獲取統計信息
     * @returns {Object} 統計信息
     */
    getStatistics() {
        return {
            ...this.stats,
            indexStatistics: this.options.enableIndexing ?
                this.indexer.getStatistics() : null,
            sessionStatistics: this._getSessionStatistics()
        };
    }

    /**
     * 清空所有歷史記錄
     */
    clear() {
        this.entries.clear();
        this.sessions.clear();
        this.navigationHistory = [];
        this.currentPosition = -1;

        if (this.options.enableIndexing) {
            this.indexer.clear();
        }

        this._updateStatistics();
        this.emit('cleared');

        console.log('[CommandHistory] 已清空所有歷史記錄');
    }

    // ========== 私有方法 ==========

    /**
     * 生成會話ID
     * @private
     */
    _generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 創建會話
     * @private
     */
    _createSession(sessionId) {
        const session = {
            id: sessionId,
            startTime: Date.now(),
            lastActivity: Date.now(),
            entries: [],
            metadata: {
                userAgent: navigator?.userAgent || '',
                platform: navigator?.platform || '',
                workingDirectory: process?.cwd?.() || ''
            }
        };

        this.sessions.set(sessionId, session);
        this.stats.totalSessions++;

        console.log(`[CommandHistory] 創建新會話: ${sessionId}`);
        return session;
    }

    /**
     * 查找重複條目
     * @private
     */
    _findDuplicateEntry(command) {
        // 查找最近1分鐘內的相同命令
        const oneMinuteAgo = Date.now() - 60000;

        for (const entry of this.entries.values()) {
            if (entry.command === command &&
                entry.timestamp > oneMinuteAgo &&
                entry.sessionId === this.currentSessionId) {
                return entry;
            }
        }

        return null;
    }

    /**
     * 強制存儲限制
     * @private
     */
    _enforceStorageLimit() {
        if (this.entries.size <= this.options.maxHistorySize) return;

        const excess = this.entries.size - this.options.maxHistorySize;
        const oldestEntries = Array.from(this.entries.values())
            .filter(entry => !entry.favorite) // 保護收藏項目
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, excess);

        for (const entry of oldestEntries) {
            this.deleteEntry(entry.id);
        }

        console.log(`[CommandHistory] 強制清理 ${excess} 條舊記錄`);
    }

    /**
     * 排序結果
     * @private
     */
    _sortResults(results, sortBy) {
        switch (sortBy) {
            case SORT_ORDER.RECENT:
                return results.sort((a, b) => b.timestamp - a.timestamp);

            case SORT_ORDER.OLDEST:
                return results.sort((a, b) => a.timestamp - b.timestamp);

            case SORT_ORDER.FREQUENCY:
                return results.sort((a, b) => b.frequency - a.frequency);

            case SORT_ORDER.SUCCESS_RATE:
                return results.sort((a, b) => b.getSuccessRate() - a.getSuccessRate());

            case SORT_ORDER.EXECUTION_TIME:
                return results.sort((a, b) => a.executionTime - b.executionTime);

            case SORT_ORDER.ALPHABETICAL:
                return results.sort((a, b) => a.command.localeCompare(b.command));

            default:
                return results;
        }
    }

    /**
     * 更新統計信息
     * @private
     */
    _updateStatistics() {
        const entries = Array.from(this.entries.values());

        this.stats.totalCommands = entries.length;
        this.stats.totalExecutionTime = entries.reduce((sum, e) => sum + e.executionTime, 0);
        this.stats.averageExecutionTime = entries.length > 0 ?
            this.stats.totalExecutionTime / entries.length : 0;

        const successCount = entries.filter(e => e.status === HISTORY_ENTRY_STATUS.SUCCESS).length;
        this.stats.successRate = entries.length > 0 ? successCount / entries.length : 0;

        // 最常用命令
        const commandFrequency = new Map();
        entries.forEach(entry => {
            const count = commandFrequency.get(entry.command) || 0;
            commandFrequency.set(entry.command, count + 1);
        });

        this.stats.mostUsedCommands = Array.from(commandFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([command, count]) => ({ command, count }));

        // 最近活動
        this.stats.recentActivity = entries
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20)
            .map(e => ({
                command: e.command,
                timestamp: e.timestamp,
                status: e.status
            }));
    }

    /**
     * 獲取會話統計
     * @private
     */
    _getSessionStatistics() {
        return {
            totalSessions: this.sessions.size,
            currentSession: this.currentSessionId,
            activeSessions: Array.from(this.sessions.values())
                .filter(s => (Date.now() - s.lastActivity) < this.options.sessionTimeout)
                .length,
            averageSessionLength: this._calculateAverageSessionLength()
        };
    }

    /**
     * 計算平均會話長度
     * @private
     */
    _calculateAverageSessionLength() {
        const sessions = Array.from(this.sessions.values());
        if (sessions.length === 0) return 0;

        const totalLength = sessions.reduce((sum, session) => {
            const endTime = session.endTime || Date.now();
            return sum + (endTime - session.startTime);
        }, 0);

        return totalLength / sessions.length;
    }

    /**
     * 清理過期會話
     * @private
     */
    _cleanupExpiredSessions() {
        const now = Date.now();
        const expiredThreshold = now - this.options.sessionTimeout;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.lastActivity < expiredThreshold && sessionId !== this.currentSessionId) {
                session.endTime = session.lastActivity;
                // 可以選擇刪除過期會話或保留用於統計
                console.log(`[CommandHistory] 會話過期: ${sessionId}`);
            }
        }
    }

    /**
     * 重建索引
     * @private
     */
    _rebuildIndexes() {
        if (!this.options.enableIndexing) return;

        this.indexer.clear();

        for (const entry of this.entries.values()) {
            this.indexer.addEntry(entry);
        }

        console.log(`[CommandHistory] 索引重建完成，${this.entries.size} 條記錄`);
    }

    /**
     * 從存儲載入
     * @private
     */
    async _loadFromStorage() {
        try {
            // 這裡可以接入實際的存儲系統
            // 例如: localStorage, IndexedDB, 文件系統等
            console.log('[CommandHistory] 從持久存儲載入歷史記錄...');
        } catch (error) {
            console.warn('[CommandHistory] 載入失敗:', error);
        }
    }

    /**
     * 保存到存儲
     * @private
     */
    async _saveToStorage() {
        if (!this.options.enablePersistence) return;

        try {
            const data = this.export({ format: 'json', includeArchived: true });

            // 這裡可以接入實際的存儲系統
            console.log(`[CommandHistory] 保存 ${data.totalEntries} 條歷史記錄到持久存儲`);
            this.emit('saved', { entriesCount: data.totalEntries });

        } catch (error) {
            console.error('[CommandHistory] 保存失敗:', error);
            this.emit('saveError', error);
        }
    }

    /**
     * 啟動自動保存
     * @private
     */
    _startAutoSave() {
        if (this.saveTimer) return;

        this.saveTimer = setInterval(() => {
            this._saveToStorage();
        }, this.options.saveInterval);

        console.log(`[CommandHistory] 自動保存已啟動，間隔: ${this.options.saveInterval}ms`);
    }

    /**
     * 停止自動保存
     * @private
     */
    _stopAutoSave() {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = null;
            console.log('[CommandHistory] 自動保存已停止');
        }
    }

    /**
     * 導出為CSV格式
     * @private
     */
    _exportToCSV(entries) {
        const headers = [
            'ID', 'Command', 'Status', 'Timestamp', 'Execution Time',
            'Success Rate', 'Frequency', 'Tags', 'Category'
        ];

        const rows = entries.map(entry => [
            entry.id,
            `"${entry.command}"`,
            entry.status,
            new Date(entry.timestamp).toISOString(),
            entry.executionTime,
            entry.getSuccessRate(),
            entry.frequency,
            `"${entry.tags.join(',')}"`,
            entry.category
        ]);

        return headers.join(',') + '\n' + rows.map(row => row.join(',')).join('\n');
    }

    /**
     * 導出為文本格式
     * @private
     */
    _exportToText(entries) {
        let text = `Command History Export\n`;
        text += `Generated: ${new Date().toISOString()}\n`;
        text += `Total Entries: ${entries.length}\n`;
        text += `${'='.repeat(50)}\n\n`;

        entries.forEach(entry => {
            text += `[${new Date(entry.timestamp).toLocaleString()}] ${entry.command}\n`;
            text += `Status: ${entry.status} | Time: ${entry.executionTime}ms | Freq: ${entry.frequency}\n`;
            if (entry.tags.length > 0) {
                text += `Tags: ${entry.tags.join(', ')}\n`;
            }
            if (entry.note) {
                text += `Note: ${entry.note}\n`;
            }
            text += '\n';
        });

        return text;
    }

    /**
     * 驗證條目數據
     * @private
     */
    _validateEntryData(data) {
        return data &&
               typeof data.id === 'string' &&
               typeof data.command === 'string' &&
               typeof data.timestamp === 'number';
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            // 停止自動保存
            this._stopAutoSave();

            // 最後保存
            await this._saveToStorage();

            // 清理數據
            this.clear();

            this.removeAllListeners();
            console.log('[CommandHistory] 資源清理完成');

        } catch (error) {
            console.error('[CommandHistory] 資源清理失敗:', error);
            throw error;
        }
    }
}

export default CommandHistory;