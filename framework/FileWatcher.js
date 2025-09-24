/**
 * FileWatcher - 檔案系統變化監控
 *
 * 功能：
 * - 檔案系統變化監控
 * - 批量變化處理和去重
 * - 忽略規則和過濾機制
 * - 高性能監控支持（1000+檔案時CPU < 5%）
 *
 * 用途：監控指定路徑的檔案變化，觸發狀態同步
 * 配合：與StateSynchronizer配合進行即時狀態同步
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * 變化事件類型
 */
const CHANGE_TYPES = {
    CREATED: 'created',
    MODIFIED: 'modified',
    DELETED: 'deleted',
    RENAMED: 'renamed'
};

/**
 * 監控選項
 */
const DEFAULT_OPTIONS = {
    recursive: true,
    persistent: true,
    encoding: 'utf8',
    // 批量處理配置
    batchDelay: 100, // 批量處理延遲（毫秒）
    maxBatchSize: 50, // 最大批量大小
    // 性能配置
    debounceDelay: 50, // 去重延遲（毫秒）
    maxWatchers: 1000, // 最大監控器數量
    // 檔案大小限制
    maxFileSize: 10 * 1024 * 1024, // 10MB
    // 忽略規則
    ignorePatterns: [
        'node_modules/**',
        'dist/**',
        '.git/**',
        '*.log',
        '*.tmp',
        '.env*'
    ]
};

/**
 * 檔案監控器
 */
class FileWatcher extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.watchers = new Map(); // 活動的監控器
        this.watchedPaths = new Set(); // 已監控的路徑
        this.pendingChanges = new Map(); // 待處理的變化
        this.batchTimer = null; // 批量處理計時器
        this.debounceTimers = new Map(); // 去重計時器

        // 忽略規則編譯
        this.ignoreRegexps = this._compileIgnorePatterns(this.options.ignorePatterns);

        // 統計信息
        this.stats = {
            totalWatchers: 0,
            totalEvents: 0,
            batchedEvents: 0,
            ignoredEvents: 0,
            startTime: Date.now()
        };
    }

    /**
     * 開始監控指定路徑
     * @param {string|Array<string>} paths 要監控的路徑
     * @param {object} options 監控選項
     */
    async watch(paths, options = {}) {
        const pathsArray = Array.isArray(paths) ? paths : [paths];
        const watchOptions = { ...this.options, ...options };

        for (const watchPath of pathsArray) {
            try {
                await this._watchPath(watchPath, watchOptions);
            } catch (error) {
                console.error(`[FileWatcher] 監控路徑失敗: ${watchPath}`, error);
                this.emit('error', error, watchPath);
            }
        }
    }

    /**
     * 停止監控指定路徑
     * @param {string|Array<string>} paths 要停止監控的路徑
     */
    async unwatch(paths) {
        const pathsArray = Array.isArray(paths) ? paths : [paths];

        for (const watchPath of pathsArray) {
            const normalizedPath = path.resolve(watchPath);

            if (this.watchers.has(normalizedPath)) {
                const watcher = this.watchers.get(normalizedPath);
                watcher.close();
                this.watchers.delete(normalizedPath);
                this.watchedPaths.delete(normalizedPath);
                this.stats.totalWatchers--;

                console.log(`[FileWatcher] 已停止監控: ${watchPath}`);
            }
        }
    }

    /**
     * 停止所有監控
     */
    async unwatchAll() {
        // 停止批量處理計時器
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        // 停止所有去重計時器
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // 關閉所有監控器
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }

        this.watchers.clear();
        this.watchedPaths.clear();
        this.pendingChanges.clear();
        this.stats.totalWatchers = 0;

        console.log('[FileWatcher] 已停止所有監控');
    }

    /**
     * 添加忽略規則
     * @param {Array<string>} patterns 忽略模式
     */
    addIgnorePatterns(patterns) {
        this.options.ignorePatterns.push(...patterns);
        this.ignoreRegexps = this._compileIgnorePatterns(this.options.ignorePatterns);
        console.log(`[FileWatcher] 已添加 ${patterns.length} 條忽略規則`);
    }

    /**
     * 移除忽略規則
     * @param {Array<string>} patterns 要移除的忽略模式
     */
    removeIgnorePatterns(patterns) {
        for (const pattern of patterns) {
            const index = this.options.ignorePatterns.indexOf(pattern);
            if (index !== -1) {
                this.options.ignorePatterns.splice(index, 1);
            }
        }
        this.ignoreRegexps = this._compileIgnorePatterns(this.options.ignorePatterns);
        console.log(`[FileWatcher] 已移除 ${patterns.length} 條忽略規則`);
    }

    /**
     * 獲取監控統計信息
     */
    getStatistics() {
        const runtime = Date.now() - this.stats.startTime;
        return {
            ...this.stats,
            runtime: runtime,
            eventsPerSecond: this.stats.totalEvents / (runtime / 1000),
            watchedPaths: Array.from(this.watchedPaths),
            pendingChangesCount: this.pendingChanges.size
        };
    }

    /**
     * 手動觸發批量處理
     */
    async flushPendingChanges() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        await this._processBatch();
    }

    // ========== 私有方法 ==========

    /**
     * 監控單個路徑
     */
    async _watchPath(watchPath, options) {
        const normalizedPath = path.resolve(watchPath);

        // 檢查路徑是否已被監控
        if (this.watchedPaths.has(normalizedPath)) {
            console.log(`[FileWatcher] 路徑已被監控: ${watchPath}`);
            return;
        }

        // 檢查路徑是否存在
        try {
            await fs.access(normalizedPath);
        } catch (error) {
            throw new Error(`監控路徑不存在: ${watchPath}`);
        }

        // 檢查監控器數量限制
        if (this.stats.totalWatchers >= this.options.maxWatchers) {
            throw new Error(`已達到最大監控器數量限制: ${this.options.maxWatchers}`);
        }

        // 創建檔案監控器
        const watcher = fsSync.watch(normalizedPath, {
            recursive: options.recursive,
            persistent: options.persistent,
            encoding: options.encoding
        }, (eventType, filename) => {
            this._handleFileChange(normalizedPath, eventType, filename);
        });

        // 處理監控器錯誤
        watcher.on('error', (error) => {
            console.error(`[FileWatcher] 監控器錯誤: ${normalizedPath}`, error);
            this.emit('error', error, normalizedPath);
        });

        this.watchers.set(normalizedPath, watcher);
        this.watchedPaths.add(normalizedPath);
        this.stats.totalWatchers++;

        console.log(`[FileWatcher] 開始監控: ${watchPath}`);
    }

    /**
     * 處理檔案變化事件
     */
    _handleFileChange(basePath, eventType, filename) {
        if (!filename) return;

        const fullPath = path.join(basePath, filename);
        const relativePath = path.relative(process.cwd(), fullPath);

        this.stats.totalEvents++;

        // 檢查是否應該忽略
        if (this._shouldIgnore(relativePath)) {
            this.stats.ignoredEvents++;
            return;
        }

        // 去重處理
        const changeKey = `${fullPath}:${eventType}`;
        if (this.debounceTimers.has(changeKey)) {
            clearTimeout(this.debounceTimers.get(changeKey));
        }

        this.debounceTimers.set(changeKey, setTimeout(() => {
            this.debounceTimers.delete(changeKey);
            this._queueChange(fullPath, eventType);
        }, this.options.debounceDelay));
    }

    /**
     * 將變化加入處理隊列
     */
    async _queueChange(fullPath, eventType) {
        try {
            // 獲取檔案資訊
            let stats = null;
            let changeType = CHANGE_TYPES.DELETED;

            try {
                stats = await fs.stat(fullPath);
                changeType = this._determineChangeType(fullPath, eventType, stats);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`[FileWatcher] 獲取檔案資訊失敗: ${fullPath}`, error);
                    return;
                }
                // 檔案不存在，確認為刪除事件
                changeType = CHANGE_TYPES.DELETED;
            }

            // 檢查檔案大小限制
            if (stats && stats.size > this.options.maxFileSize) {
                console.warn(`[FileWatcher] 檔案過大，跳過: ${fullPath} (${stats.size} bytes)`);
                return;
            }

            // 生成變化記錄
            const change = {
                path: fullPath,
                relativePath: path.relative(process.cwd(), fullPath),
                type: changeType,
                timestamp: new Date().toISOString(),
                stats: stats ? {
                    size: stats.size,
                    mtime: stats.mtime,
                    isFile: stats.isFile(),
                    isDirectory: stats.isDirectory()
                } : null
            };

            // 添加檔案內容哈希（僅針對小檔案）
            if (stats && stats.isFile() && stats.size < 64 * 1024) { // 64KB
                try {
                    const content = await fs.readFile(fullPath, 'utf8');
                    change.contentHash = crypto.createHash('sha256').update(content).digest('hex');
                } catch (error) {
                    // 無法讀取內容，跳過哈希計算
                }
            }

            // 加入待處理隊列
            this.pendingChanges.set(fullPath, change);

            // 啟動批量處理
            this._scheduleBatchProcessing();

        } catch (error) {
            console.error('[FileWatcher] 處理檔案變化失敗:', error);
            this.emit('error', error, fullPath);
        }
    }

    /**
     * 確定變化類型
     */
    _determineChangeType(fullPath, eventType, stats) {
        switch (eventType) {
            case 'rename':
                // rename 事件可能是創建、刪除或重命名
                return stats ? CHANGE_TYPES.CREATED : CHANGE_TYPES.DELETED;
            case 'change':
                return CHANGE_TYPES.MODIFIED;
            default:
                return stats ? CHANGE_TYPES.CREATED : CHANGE_TYPES.DELETED;
        }
    }

    /**
     * 安排批量處理
     */
    _scheduleBatchProcessing() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        this.batchTimer = setTimeout(() => {
            this.batchTimer = null;
            this._processBatch();
        }, this.options.batchDelay);

        // 如果待處理變化過多，立即處理
        if (this.pendingChanges.size >= this.options.maxBatchSize) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
            this._processBatch();
        }
    }

    /**
     * 處理批量變化
     */
    async _processBatch() {
        if (this.pendingChanges.size === 0) return;

        const changes = Array.from(this.pendingChanges.values());
        this.pendingChanges.clear();

        this.stats.batchedEvents += changes.length;

        try {
            // 發送批量變化事件
            this.emit('batchChange', changes);

            // 發送個別變化事件（為了向後兼容）
            for (const change of changes) {
                this.emit('change', change);
            }

        } catch (error) {
            console.error('[FileWatcher] 批量處理失敗:', error);
            this.emit('error', error);
        }
    }

    /**
     * 檢查是否應該忽略路徑
     */
    _shouldIgnore(relativePath) {
        // 標準化路徑（使用 Unix 風格的分隔符）
        const normalizedPath = relativePath.replace(/\\/g, '/');

        for (const regexp of this.ignoreRegexps) {
            if (regexp.test(normalizedPath)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 編譯忽略模式為正則表達式
     */
    _compileIgnorePatterns(patterns) {
        return patterns.map(pattern => {
            // 轉換 glob 模式為正則表達式
            let regex = pattern
                .replace(/\./g, '\\.')  // 轉義點號
                .replace(/\*\*/g, '.*') // ** 匹配任意深度目錄
                .replace(/\*/g, '[^/]*') // * 匹配單層目錄
                .replace(/\?/g, '.'); // ? 匹配單個字符

            // 如果模式以 / 結尾，只匹配目錄
            if (pattern.endsWith('/')) {
                regex += '$';
            } else {
                // 匹配整個路徑或路徑片段
                regex = `(^|/)${regex}(/|$)`;
            }

            return new RegExp(regex);
        });
    }
}

// 導出變化類型常數
FileWatcher.CHANGE_TYPES = CHANGE_TYPES;

module.exports = FileWatcher;