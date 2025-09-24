/**
 * StateStore - 狀態存儲和管理
 *
 * 功能：
 * - 狀態快照存儲和管理
 * - 狀態版本控制
 * - 狀態查詢和比較功能
 * - JSON格式狀態序列化
 * - 基於哈希的變化檢測
 *
 * 用途：為狀態同步機制提供持久化存儲服務
 * 配合：與StateSynchronizer、FileWatcher協作進行狀態管理
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * 狀態類型定義
 */
const STATE_TYPES = {
    FILESYSTEM: 'filesystem',
    PROJECT: 'project',
    RUNTIME: 'runtime'
};

/**
 * 狀態存儲器
 */
class StateStore {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(process.cwd(), '.claude', 'data');
        this.stateFile = path.join(this.dataDir, 'state.db');
        this.maxVersions = options.maxVersions || 50;
        this.compressionThreshold = options.compressionThreshold || 1024 * 1024; // 1MB

        // 內存快取
        this.cache = new Map();
        this.cacheMaxSize = options.cacheMaxSize || 100;

        // 狀態索引 - 用於快速查詢
        this.stateIndex = new Map();

        // 初始化
        this.initialized = false;
    }

    /**
     * 初始化狀態存儲
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 確保數據目錄存在
            await fs.mkdir(this.dataDir, { recursive: true });

            // 載入現有狀態
            await this._loadStateDatabase();

            // 建立索引
            await this._buildStateIndex();

            this.initialized = true;
            console.log(`[StateStore] 已初始化，數據目錄: ${this.dataDir}`);
        } catch (error) {
            console.error('[StateStore] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 儲存狀態快照
     * @param {string} type 狀態類型
     * @param {object} state 狀態數據
     * @param {object} metadata 元數據
     * @returns {Promise<string>} 狀態ID
     */
    async saveState(type, state, metadata = {}) {
        await this._ensureInitialized();

        const stateId = this._generateStateId(type, state);
        const timestamp = new Date().toISOString();
        const stateHash = this._calculateStateHash(state);

        const stateRecord = {
            id: stateId,
            type,
            timestamp,
            hash: stateHash,
            state: this._serializeState(state),
            metadata: {
                ...metadata,
                version: await this._getNextVersion(type),
                size: JSON.stringify(state).length
            }
        };

        try {
            // 更新快取
            this._updateCache(stateId, stateRecord);

            // 更新索引
            this._updateIndex(type, stateRecord);

            // 持久化存儲
            await this._persistState();

            // 清理舊版本
            await this._cleanupOldVersions(type);

            console.log(`[StateStore] 已儲存狀態: ${type}/${stateId}`);
            return stateId;

        } catch (error) {
            console.error('[StateStore] 儲存狀態失敗:', error);
            throw error;
        }
    }

    /**
     * 讀取狀態
     * @param {string} stateId 狀態ID
     * @returns {Promise<object>} 狀態數據
     */
    async getState(stateId) {
        await this._ensureInitialized();

        // 檢查快取
        if (this.cache.has(stateId)) {
            const record = this.cache.get(stateId);
            return this._deserializeState(record.state);
        }

        // 從持久化存儲讀取
        const record = await this._findStateById(stateId);
        if (!record) {
            throw new Error(`狀態不存在: ${stateId}`);
        }

        // 更新快取
        this._updateCache(stateId, record);

        return this._deserializeState(record.state);
    }

    /**
     * 獲取狀態歷史
     * @param {string} type 狀態類型
     * @param {number} limit 返回數量限制
     * @returns {Promise<Array>} 狀態歷史列表
     */
    async getStateHistory(type, limit = 10) {
        await this._ensureInitialized();

        const typeIndex = this.stateIndex.get(type) || [];

        return typeIndex
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit)
            .map(record => ({
                id: record.id,
                timestamp: record.timestamp,
                hash: record.hash,
                metadata: record.metadata
            }));
    }

    /**
     * 比較兩個狀態
     * @param {string} stateId1 第一個狀態ID
     * @param {string} stateId2 第二個狀態ID
     * @returns {Promise<object>} 比較結果
     */
    async compareStates(stateId1, stateId2) {
        const [state1, state2] = await Promise.all([
            this.getState(stateId1),
            this.getState(stateId2)
        ]);

        return this._deepCompare(state1, state2);
    }

    /**
     * 檢測狀態變化
     * @param {string} type 狀態類型
     * @param {object} currentState 當前狀態
     * @returns {Promise<object>} 變化檢測結果
     */
    async detectChanges(type, currentState) {
        await this._ensureInitialized();

        const currentHash = this._calculateStateHash(currentState);
        const latestState = await this.getLatestState(type);

        if (!latestState) {
            return {
                hasChanges: true,
                isNew: true,
                changes: null,
                previousHash: null,
                currentHash
            };
        }

        const previousHash = this._calculateStateHash(latestState);
        const hasChanges = currentHash !== previousHash;

        let changes = null;
        if (hasChanges) {
            changes = this._deepCompare(latestState, currentState);
        }

        return {
            hasChanges,
            isNew: false,
            changes,
            previousHash,
            currentHash
        };
    }

    /**
     * 獲取最新狀態
     * @param {string} type 狀態類型
     * @returns {Promise<object>} 最新狀態
     */
    async getLatestState(type) {
        await this._ensureInitialized();

        const typeIndex = this.stateIndex.get(type) || [];
        if (typeIndex.length === 0) {
            return null;
        }

        const latest = typeIndex
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        return this._deserializeState(latest.state);
    }

    /**
     * 刪除狀態
     * @param {string} stateId 狀態ID
     */
    async deleteState(stateId) {
        await this._ensureInitialized();

        // 從快取中移除
        this.cache.delete(stateId);

        // 從索引中移除
        for (const [type, records] of this.stateIndex) {
            const index = records.findIndex(r => r.id === stateId);
            if (index !== -1) {
                records.splice(index, 1);
                break;
            }
        }

        // 持久化更新
        await this._persistState();

        console.log(`[StateStore] 已刪除狀態: ${stateId}`);
    }

    /**
     * 清理資料庫
     * @param {object} options 清理選項
     */
    async cleanup(options = {}) {
        const {
            maxAge = 30 * 24 * 60 * 60 * 1000, // 30天
            maxVersions = this.maxVersions
        } = options;

        const cutoffTime = new Date(Date.now() - maxAge);
        let deletedCount = 0;

        for (const [type, records] of this.stateIndex) {
            // 按時間排序，保留最新的版本
            records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // 刪除超過版本限制或過期的記錄
            const toDelete = records.filter((record, index) => {
                return index >= maxVersions || new Date(record.timestamp) < cutoffTime;
            });

            for (const record of toDelete) {
                const index = records.indexOf(record);
                if (index !== -1) {
                    records.splice(index, 1);
                    this.cache.delete(record.id);
                    deletedCount++;
                }
            }
        }

        if (deletedCount > 0) {
            await this._persistState();
            console.log(`[StateStore] 清理完成，刪除 ${deletedCount} 條記錄`);
        }

        return deletedCount;
    }

    /**
     * 獲取存儲統計信息
     */
    async getStatistics() {
        await this._ensureInitialized();

        const stats = {
            totalStates: 0,
            statesByType: {},
            cacheSize: this.cache.size,
            totalSize: 0
        };

        for (const [type, records] of this.stateIndex) {
            stats.statesByType[type] = records.length;
            stats.totalStates += records.length;
            stats.totalSize += records.reduce((sum, r) => sum + (r.metadata.size || 0), 0);
        }

        return stats;
    }

    // ========== 私有方法 ==========

    /**
     * 確保已初始化
     */
    async _ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * 載入狀態資料庫
     */
    async _loadStateDatabase() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf8');
            const database = JSON.parse(data);

            // 載入狀態到快取
            if (database.states) {
                for (const [stateId, record] of Object.entries(database.states)) {
                    this._updateCache(stateId, record);
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('[StateStore] 載入狀態資料庫失敗:', error.message);
            }
            // 檔案不存在時會創建新的資料庫
        }
    }

    /**
     * 建立狀態索引
     */
    async _buildStateIndex() {
        this.stateIndex.clear();

        for (const [stateId, record] of this.cache) {
            this._updateIndex(record.type, record);
        }
    }

    /**
     * 持久化狀態到檔案
     */
    async _persistState() {
        const database = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            states: {}
        };

        // 將快取中的狀態寫入資料庫
        for (const [stateId, record] of this.cache) {
            database.states[stateId] = record;
        }

        await fs.writeFile(this.stateFile, JSON.stringify(database, null, 2));
    }

    /**
     * 更新快取
     */
    _updateCache(stateId, record) {
        // LRU 快取管理
        if (this.cache.has(stateId)) {
            this.cache.delete(stateId);
        } else if (this.cache.size >= this.cacheMaxSize) {
            // 刪除最舊的項目
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(stateId, record);
    }

    /**
     * 更新索引
     */
    _updateIndex(type, record) {
        if (!this.stateIndex.has(type)) {
            this.stateIndex.set(type, []);
        }

        const typeIndex = this.stateIndex.get(type);

        // 檢查是否已存在
        const existingIndex = typeIndex.findIndex(r => r.id === record.id);
        if (existingIndex !== -1) {
            typeIndex[existingIndex] = record;
        } else {
            typeIndex.push(record);
        }
    }

    /**
     * 生成狀態ID
     */
    _generateStateId(type, state) {
        const content = JSON.stringify({ type, state, timestamp: Date.now() });
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    /**
     * 計算狀態哈希
     */
    _calculateStateHash(state) {
        const normalized = this._normalizeState(state);
        return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    }

    /**
     * 標準化狀態對象（排序鍵值，移除不穩定字段）
     */
    _normalizeState(obj) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => this._normalizeState(item));

        const normalized = {};
        const keys = Object.keys(obj).sort();

        for (const key of keys) {
            // 排除不穩定的時間戳字段
            if (key.includes('timestamp') || key.includes('mtime') || key.includes('lastModified')) {
                continue;
            }
            normalized[key] = this._normalizeState(obj[key]);
        }

        return normalized;
    }

    /**
     * 序列化狀態
     */
    _serializeState(state) {
        return JSON.stringify(state);
    }

    /**
     * 反序列化狀態
     */
    _deserializeState(serializedState) {
        return JSON.parse(serializedState);
    }

    /**
     * 深度比較兩個狀態
     */
    _deepCompare(obj1, obj2, path = '') {
        const changes = {
            added: {},
            removed: {},
            modified: {},
            unchanged: {}
        };

        const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const val1 = obj1?.[key];
            const val2 = obj2?.[key];

            if (!(key in (obj1 || {}))) {
                changes.added[currentPath] = val2;
            } else if (!(key in (obj2 || {}))) {
                changes.removed[currentPath] = val1;
            } else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
                const subChanges = this._deepCompare(val1, val2, currentPath);
                Object.assign(changes.added, subChanges.added);
                Object.assign(changes.removed, subChanges.removed);
                Object.assign(changes.modified, subChanges.modified);
                Object.assign(changes.unchanged, subChanges.unchanged);
            } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                changes.modified[currentPath] = { from: val1, to: val2 };
            } else {
                changes.unchanged[currentPath] = val1;
            }
        }

        return changes;
    }

    /**
     * 根據ID查找狀態
     */
    async _findStateById(stateId) {
        for (const records of this.stateIndex.values()) {
            const record = records.find(r => r.id === stateId);
            if (record) return record;
        }
        return null;
    }

    /**
     * 獲取下一個版本號
     */
    async _getNextVersion(type) {
        const typeIndex = this.stateIndex.get(type) || [];
        const maxVersion = typeIndex.reduce((max, record) => {
            return Math.max(max, record.metadata.version || 0);
        }, 0);

        return maxVersion + 1;
    }

    /**
     * 清理舊版本
     */
    async _cleanupOldVersions(type) {
        const typeIndex = this.stateIndex.get(type) || [];

        if (typeIndex.length > this.maxVersions) {
            // 按時間戳排序，保留最新的版本
            typeIndex.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // 移除超過限制的版本
            const toRemove = typeIndex.splice(this.maxVersions);

            // 從快取中移除
            for (const record of toRemove) {
                this.cache.delete(record.id);
            }
        }
    }
}

// 導出狀態類型常數
StateStore.STATE_TYPES = STATE_TYPES;

module.exports = StateStore;