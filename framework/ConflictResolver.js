/**
 * ConflictResolver - 狀態衝突檢測和解決
 *
 * 功能：
 * - 狀態衝突檢測
 * - 自動和手動解決策略
 * - 衝突歷史記錄
 * - 多種衝突解決策略
 *
 * 用途：處理CCPM和SuperClaude間的狀態衝突
 * 配合：與StateSynchronizer配合確保狀態一致性
 */

import fs from 'fs'.promises;
import path from 'path';
import { EventEmitter } from 'events';

/**
 * 衝突類型
 */
const CONFLICT_TYPES = {
    CONCURRENT_MODIFICATION: 'concurrent_modification', // 併發修改
    SCHEMA_MISMATCH: 'schema_mismatch',                // 結構不匹配
    TYPE_CONFLICT: 'type_conflict',                    // 類型衝突
    VALIDATION_ERROR: 'validation_error',              // 驗證錯誤
    DEPENDENCY_CONFLICT: 'dependency_conflict'         // 依賴衝突
};

/**
 * 解決策略
 */
const RESOLUTION_STRATEGIES = {
    AUTO_MERGE: 'auto_merge',           // 自動合併
    SOURCE_WINS: 'source_wins',         // 源優先
    TARGET_WINS: 'target_wins',         // 目標優先
    NEWEST_WINS: 'newest_wins',         // 最新優先
    MANUAL: 'manual',                   // 手動解決
    THREE_WAY_MERGE: 'three_way_merge'  // 三路合併
};

/**
 * 衝突嚴重度
 */
const CONFLICT_SEVERITY = {
    LOW: 'low',       // 低：可自動解決
    MEDIUM: 'medium', // 中：需要策略選擇
    HIGH: 'high',     // 高：需要手動介入
    CRITICAL: 'critical' // 嚴重：可能導致系統不穩定
};

/**
 * 衝突解決器
 */
class ConflictResolver extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            defaultStrategy: RESOLUTION_STRATEGIES.AUTO_MERGE,
            autoResolveThreshold: CONFLICT_SEVERITY.MEDIUM,
            maxConflictHistory: 1000,
            conflictDir: path.join(process.cwd(), '.claude', 'data', 'conflicts'),
            enableLogging: true,
            ...options
        };

        // 衝突歷史
        this.conflictHistory = [];

        // 解決策略映射
        this.strategyHandlers = new Map([
            [RESOLUTION_STRATEGIES.AUTO_MERGE, this._autoMergeStrategy.bind(this)],
            [RESOLUTION_STRATEGIES.SOURCE_WINS, this._sourceWinsStrategy.bind(this)],
            [RESOLUTION_STRATEGIES.TARGET_WINS, this._targetWinsStrategy.bind(this)],
            [RESOLUTION_STRATEGIES.NEWEST_WINS, this._newestWinsStrategy.bind(this)],
            [RESOLUTION_STRATEGIES.THREE_WAY_MERGE, this._threeWayMergeStrategy.bind(this)],
            [RESOLUTION_STRATEGIES.MANUAL, this._manualStrategy.bind(this)]
        ]);

        // 衝突檢測規則
        this.conflictRules = new Map();
        this._initializeDefaultRules();
    }

    /**
     * 初始化
     */
    async initialize() {
        try {
            // 確保衝突記錄目錄存在
            await fs.mkdir(this.options.conflictDir, { recursive: true });

            // 載入衝突歷史
            await this._loadConflictHistory();

            console.log('[ConflictResolver] 已初始化');
        } catch (error) {
            console.error('[ConflictResolver] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 檢測狀態衝突
     * @param {object} sourceState 源狀態
     * @param {object} targetState 目標狀態
     * @param {object} baseState 基礎狀態（用於三路合併）
     * @param {object} context 上下文信息
     * @returns {Promise<Array>} 檢測到的衝突列表
     */
    async detectConflicts(sourceState, targetState, baseState = null, context = {}) {
        const conflicts = [];

        try {
            // 基本衝突檢測
            const basicConflicts = await this._detectBasicConflicts(sourceState, targetState, context);
            conflicts.push(...basicConflicts);

            // 結構衝突檢測
            const structureConflicts = await this._detectStructureConflicts(sourceState, targetState, context);
            conflicts.push(...structureConflicts);

            // 類型衝突檢測
            const typeConflicts = await this._detectTypeConflicts(sourceState, targetState, context);
            conflicts.push(...typeConflicts);

            // 依賴衝突檢測
            const dependencyConflicts = await this._detectDependencyConflicts(sourceState, targetState, context);
            conflicts.push(...dependencyConflicts);

            // 自定義規則檢測
            const customConflicts = await this._detectCustomConflicts(sourceState, targetState, context);
            conflicts.push(...customConflicts);

            // 計算衝突嚴重度
            for (const conflict of conflicts) {
                conflict.severity = this._calculateConflictSeverity(conflict);
                conflict.resolvable = conflict.severity <= this.options.autoResolveThreshold;
            }

            if (conflicts.length > 0) {
                this.emit('conflictsDetected', conflicts, context);
            }

            return conflicts;

        } catch (error) {
            console.error('[ConflictResolver] 衝突檢測失敗:', error);
            throw error;
        }
    }

    /**
     * 解決衝突
     * @param {Array} conflicts 衝突列表
     * @param {string} strategy 解決策略
     * @param {object} options 解決選項
     * @returns {Promise<object>} 解決結果
     */
    async resolveConflicts(conflicts, strategy = null, options = {}) {
        const resolveStrategy = strategy || this.options.defaultStrategy;
        const resolution = {
            strategy: resolveStrategy,
            timestamp: new Date().toISOString(),
            conflicts: conflicts,
            results: [],
            success: true,
            errors: []
        };

        try {
            const strategyHandler = this.strategyHandlers.get(resolveStrategy);
            if (!strategyHandler) {
                throw new Error(`未知的解決策略: ${resolveStrategy}`);
            }

            // 按嚴重度排序衝突
            const sortedConflicts = conflicts.sort((a, b) => {
                const severityOrder = {
                    [CONFLICT_SEVERITY.CRITICAL]: 0,
                    [CONFLICT_SEVERITY.HIGH]: 1,
                    [CONFLICT_SEVERITY.MEDIUM]: 2,
                    [CONFLICT_SEVERITY.LOW]: 3
                };
                return severityOrder[a.severity] - severityOrder[b.severity];
            });

            // 逐個解決衝突
            for (const conflict of sortedConflicts) {
                try {
                    const result = await strategyHandler(conflict, options);
                    resolution.results.push(result);

                    if (result.success) {
                        conflict.resolved = true;
                        conflict.resolution = result;
                    } else {
                        resolution.success = false;
                        resolution.errors.push(result.error);
                    }

                } catch (error) {
                    console.error(`[ConflictResolver] 解決衝突失敗:`, error);
                    resolution.success = false;
                    resolution.errors.push(error.message);
                    conflict.resolved = false;
                    conflict.error = error.message;
                }
            }

            // 記錄解決歷史
            await this._recordResolution(resolution);

            this.emit('conflictsResolved', resolution);

            return resolution;

        } catch (error) {
            console.error('[ConflictResolver] 衝突解決失敗:', error);
            resolution.success = false;
            resolution.errors.push(error.message);
            throw error;
        }
    }

    /**
     * 添加自定義衝突檢測規則
     * @param {string} name 規則名稱
     * @param {function} rule 檢測函數
     */
    addConflictRule(name, rule) {
        this.conflictRules.set(name, rule);
        console.log(`[ConflictResolver] 已添加衝突檢測規則: ${name}`);
    }

    /**
     * 移除衝突檢測規則
     * @param {string} name 規則名稱
     */
    removeConflictRule(name) {
        this.conflictRules.delete(name);
        console.log(`[ConflictResolver] 已移除衝突檢測規則: ${name}`);
    }

    /**
     * 獲取衝突統計
     */
    getConflictStatistics() {
        const stats = {
            totalConflicts: this.conflictHistory.length,
            resolvedConflicts: 0,
            unresolvedConflicts: 0,
            conflictsByType: {},
            conflictsBySeverity: {},
            resolutionsByStrategy: {}
        };

        for (const record of this.conflictHistory) {
            for (const conflict of record.conflicts || []) {
                // 統計類型
                stats.conflictsByType[conflict.type] = (stats.conflictsByType[conflict.type] || 0) + 1;

                // 統計嚴重度
                stats.conflictsBySeverity[conflict.severity] = (stats.conflictsBySeverity[conflict.severity] || 0) + 1;

                // 統計解決狀態
                if (conflict.resolved) {
                    stats.resolvedConflicts++;
                } else {
                    stats.unresolvedConflicts++;
                }
            }

            // 統計解決策略
            if (record.strategy) {
                stats.resolutionsByStrategy[record.strategy] = (stats.resolutionsByStrategy[record.strategy] || 0) + 1;
            }
        }

        return stats;
    }

    /**
     * 清理衝突歷史
     * @param {object} options 清理選項
     */
    async cleanupHistory(options = {}) {
        const {
            maxAge = 30 * 24 * 60 * 60 * 1000, // 30天
            keepRecent = 100
        } = options;

        const cutoffTime = new Date(Date.now() - maxAge);
        let removedCount = 0;

        // 按時間排序
        this.conflictHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // 保留最新記錄，刪除過期記錄
        const toKeep = [];
        for (let i = 0; i < this.conflictHistory.length; i++) {
            const record = this.conflictHistory[i];
            const recordTime = new Date(record.timestamp);

            if (i < keepRecent || recordTime >= cutoffTime) {
                toKeep.push(record);
            } else {
                removedCount++;
            }
        }

        this.conflictHistory = toKeep;

        // 持久化更新
        await this._saveConflictHistory();

        console.log(`[ConflictResolver] 清理完成，刪除 ${removedCount} 條記錄`);
        return removedCount;
    }

    // ========== 私有方法 ==========

    /**
     * 初始化默認衝突檢測規則
     */
    _initializeDefaultRules() {
        // 包依賴版本衝突
        this.addConflictRule('packageVersionConflict', (source, target) => {
            const conflicts = [];
            const sourceDeps = source.dependencies || {};
            const targetDeps = target.dependencies || {};

            for (const [pkg, sourceVersion] of Object.entries(sourceDeps)) {
                if (targetDeps[pkg] && targetDeps[pkg] !== sourceVersion) {
                    conflicts.push({
                        type: CONFLICT_TYPES.DEPENDENCY_CONFLICT,
                        field: `dependencies.${pkg}`,
                        sourceValue: sourceVersion,
                        targetValue: targetDeps[pkg],
                        description: `包 ${pkg} 版本衝突: ${sourceVersion} vs ${targetDeps[pkg]}`
                    });
                }
            }

            return conflicts;
        });

        // 配置文件結構衝突
        this.addConflictRule('configStructureConflict', (source, target) => {
            const conflicts = [];

            if (source.config && target.config) {
                const sourceKeys = Object.keys(source.config);
                const targetKeys = Object.keys(target.config);

                const missingInTarget = sourceKeys.filter(key => !targetKeys.includes(key));
                const missingInSource = targetKeys.filter(key => !sourceKeys.includes(key));

                if (missingInTarget.length > 0 || missingInSource.length > 0) {
                    conflicts.push({
                        type: CONFLICT_TYPES.SCHEMA_MISMATCH,
                        field: 'config',
                        missingInTarget,
                        missingInSource,
                        description: '配置文件結構不匹配'
                    });
                }
            }

            return conflicts;
        });
    }

    /**
     * 檢測基本衝突
     */
    async _detectBasicConflicts(sourceState, targetState, context) {
        const conflicts = [];

        // 檢測併發修改
        if (context.sourceTimestamp && context.targetTimestamp && context.baseTimestamp) {
            const sourceNewer = new Date(context.sourceTimestamp) > new Date(context.baseTimestamp);
            const targetNewer = new Date(context.targetTimestamp) > new Date(context.baseTimestamp);

            if (sourceNewer && targetNewer) {
                conflicts.push({
                    type: CONFLICT_TYPES.CONCURRENT_MODIFICATION,
                    field: '_root',
                    sourceTimestamp: context.sourceTimestamp,
                    targetTimestamp: context.targetTimestamp,
                    baseTimestamp: context.baseTimestamp,
                    description: '檢測到併發修改'
                });
            }
        }

        return conflicts;
    }

    /**
     * 檢測結構衝突
     */
    async _detectStructureConflicts(sourceState, targetState, context) {
        const conflicts = [];

        const sourceKeys = new Set(Object.keys(sourceState || {}));
        const targetKeys = new Set(Object.keys(targetState || {}));

        const sourceOnly = [...sourceKeys].filter(key => !targetKeys.has(key));
        const targetOnly = [...targetKeys].filter(key => !sourceKeys.has(key));

        if (sourceOnly.length > 0 || targetOnly.length > 0) {
            conflicts.push({
                type: CONFLICT_TYPES.SCHEMA_MISMATCH,
                field: '_structure',
                sourceOnly,
                targetOnly,
                description: '狀態結構不匹配'
            });
        }

        return conflicts;
    }

    /**
     * 檢測類型衝突
     */
    async _detectTypeConflicts(sourceState, targetState, context) {
        const conflicts = [];

        const commonKeys = Object.keys(sourceState || {})
            .filter(key => key in (targetState || {}));

        for (const key of commonKeys) {
            const sourceType = typeof sourceState[key];
            const targetType = typeof targetState[key];

            if (sourceType !== targetType) {
                conflicts.push({
                    type: CONFLICT_TYPES.TYPE_CONFLICT,
                    field: key,
                    sourceType,
                    targetType,
                    sourceValue: sourceState[key],
                    targetValue: targetState[key],
                    description: `字段 ${key} 類型衝突: ${sourceType} vs ${targetType}`
                });
            }
        }

        return conflicts;
    }

    /**
     * 檢測依賴衝突
     */
    async _detectDependencyConflicts(sourceState, targetState, context) {
        const conflicts = [];

        // 檢查依賴關係
        if (sourceState.dependencies && targetState.dependencies) {
            const sourceDeps = sourceState.dependencies;
            const targetDeps = targetState.dependencies;

            for (const [dep, sourceSpec] of Object.entries(sourceDeps)) {
                if (targetDeps[dep] && targetDeps[dep] !== sourceSpec) {
                    conflicts.push({
                        type: CONFLICT_TYPES.DEPENDENCY_CONFLICT,
                        field: `dependencies.${dep}`,
                        sourceValue: sourceSpec,
                        targetValue: targetDeps[dep],
                        description: `依賴 ${dep} 版本衝突`
                    });
                }
            }
        }

        return conflicts;
    }

    /**
     * 檢測自定義衝突
     */
    async _detectCustomConflicts(sourceState, targetState, context) {
        const conflicts = [];

        for (const [name, rule] of this.conflictRules) {
            try {
                const ruleConflicts = await rule(sourceState, targetState, context);
                if (Array.isArray(ruleConflicts)) {
                    conflicts.push(...ruleConflicts.map(c => ({ ...c, rule: name })));
                }
            } catch (error) {
                console.warn(`[ConflictResolver] 自定義規則 ${name} 執行失敗:`, error);
            }
        }

        return conflicts;
    }

    /**
     * 計算衝突嚴重度
     */
    _calculateConflictSeverity(conflict) {
        // 根據衝突類型和影響範圍計算嚴重度
        switch (conflict.type) {
            case CONFLICT_TYPES.CONCURRENT_MODIFICATION:
                return CONFLICT_SEVERITY.HIGH;
            case CONFLICT_TYPES.SCHEMA_MISMATCH:
                return CONFLICT_SEVERITY.MEDIUM;
            case CONFLICT_TYPES.TYPE_CONFLICT:
                return CONFLICT_SEVERITY.MEDIUM;
            case CONFLICT_TYPES.DEPENDENCY_CONFLICT:
                return CONFLICT_SEVERITY.HIGH;
            case CONFLICT_TYPES.VALIDATION_ERROR:
                return CONFLICT_SEVERITY.LOW;
            default:
                return CONFLICT_SEVERITY.LOW;
        }
    }

    // ========== 解決策略實現 ==========

    /**
     * 自動合併策略
     */
    async _autoMergeStrategy(conflict, options) {
        try {
            let mergedValue = null;

            switch (conflict.type) {
                case CONFLICT_TYPES.SCHEMA_MISMATCH:
                    // 合併結構差異
                    mergedValue = {
                        ...conflict.sourceValue,
                        ...conflict.targetValue
                    };
                    break;

                case CONFLICT_TYPES.DEPENDENCY_CONFLICT:
                    // 選擇較新版本（簡化實現）
                    mergedValue = this._compareVersions(conflict.sourceValue, conflict.targetValue) > 0
                        ? conflict.sourceValue
                        : conflict.targetValue;
                    break;

                default:
                    // 默認選擇目標值
                    mergedValue = conflict.targetValue;
                    break;
            }

            return {
                success: true,
                strategy: RESOLUTION_STRATEGIES.AUTO_MERGE,
                resolvedValue: mergedValue,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                strategy: RESOLUTION_STRATEGIES.AUTO_MERGE,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 源優先策略
     */
    async _sourceWinsStrategy(conflict, options) {
        return {
            success: true,
            strategy: RESOLUTION_STRATEGIES.SOURCE_WINS,
            resolvedValue: conflict.sourceValue,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 目標優先策略
     */
    async _targetWinsStrategy(conflict, options) {
        return {
            success: true,
            strategy: RESOLUTION_STRATEGIES.TARGET_WINS,
            resolvedValue: conflict.targetValue,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 最新優先策略
     */
    async _newestWinsStrategy(conflict, options) {
        const sourceTime = conflict.sourceTimestamp || 0;
        const targetTime = conflict.targetTimestamp || 0;

        const resolvedValue = new Date(sourceTime) > new Date(targetTime)
            ? conflict.sourceValue
            : conflict.targetValue;

        return {
            success: true,
            strategy: RESOLUTION_STRATEGIES.NEWEST_WINS,
            resolvedValue,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 三路合併策略
     */
    async _threeWayMergeStrategy(conflict, options) {
        // 簡化的三路合併實現
        // 實際應用中需要更複雜的合併算法
        try {
            const merged = this._performThreeWayMerge(
                conflict.baseValue,
                conflict.sourceValue,
                conflict.targetValue
            );

            return {
                success: true,
                strategy: RESOLUTION_STRATEGIES.THREE_WAY_MERGE,
                resolvedValue: merged,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                strategy: RESOLUTION_STRATEGIES.THREE_WAY_MERGE,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 手動策略
     */
    async _manualStrategy(conflict, options) {
        // 標記為需要手動解決
        return {
            success: false,
            strategy: RESOLUTION_STRATEGIES.MANUAL,
            requiresManualIntervention: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 執行三路合併
     */
    _performThreeWayMerge(base, source, target) {
        // 這是一個簡化實現
        // 實際場景需要更複雜的合併邏輯
        if (JSON.stringify(source) === JSON.stringify(base)) {
            return target; // 源未變化，使用目標
        }
        if (JSON.stringify(target) === JSON.stringify(base)) {
            return source; // 目標未變化，使用源
        }

        // 都有變化，嘗試合併
        if (typeof source === 'object' && typeof target === 'object') {
            return { ...base, ...source, ...target };
        }

        // 無法自動合併，拋出錯誤
        throw new Error('無法自動執行三路合併');
    }

    /**
     * 比較版本號
     */
    _compareVersions(v1, v2) {
        const parts1 = v1.replace(/[^\d.]/g, '').split('.').map(Number);
        const parts2 = v2.replace(/[^\d.]/g, '').split('.').map(Number);

        const maxLen = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < maxLen; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;

            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }

        return 0;
    }

    /**
     * 記錄解決歷史
     */
    async _recordResolution(resolution) {
        this.conflictHistory.push(resolution);

        // 限制歷史記錄數量
        if (this.conflictHistory.length > this.options.maxConflictHistory) {
            this.conflictHistory = this.conflictHistory.slice(-this.options.maxConflictHistory);
        }

        // 持久化保存
        await this._saveConflictHistory();
    }

    /**
     * 載入衝突歷史
     */
    async _loadConflictHistory() {
        const historyFile = path.join(this.options.conflictDir, 'history.json');

        try {
            const data = await fs.readFile(historyFile, 'utf8');
            this.conflictHistory = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('[ConflictResolver] 載入衝突歷史失敗:', error);
            }
            this.conflictHistory = [];
        }
    }

    /**
     * 保存衝突歷史
     */
    async _saveConflictHistory() {
        const historyFile = path.join(this.options.conflictDir, 'history.json');

        try {
            await fs.writeFile(historyFile, JSON.stringify(this.conflictHistory, null, 2));
        } catch (error) {
            console.error('[ConflictResolver] 保存衝突歷史失敗:', error);
        }
    }
}

// 導出常數
ConflictResolver.CONFLICT_TYPES = CONFLICT_TYPES;
ConflictResolver.RESOLUTION_STRATEGIES = RESOLUTION_STRATEGIES;
ConflictResolver.CONFLICT_SEVERITY = CONFLICT_SEVERITY;

export default ConflictResolver;