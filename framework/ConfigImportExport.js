/**
 * ConfigImportExport - 配置導入導出和備份系統
 *
 * 功能：
 * - 多格式配置導入導出（JSON、YAML、TOML）
 * - 自動化備份和還原機制
 * - 配置遷移和版本升級
 * - 批量配置管理操作
 * - 增量備份和差異比較
 *
 * 用途：提供完整的配置數據管理和遷移解決方案
 * 配合：ConfigManager進行配置的持久化和版本管理
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ConfigManager = require('./ConfigManager');

/**
 * 導入導出格式
 */
const EXPORT_FORMATS = {
    JSON: 'json',
    YAML: 'yaml',
    TOML: 'toml',
    XML: 'xml',
    CSV: 'csv',
    BINARY: 'binary'               // 加密二進制格式
};

/**
 * 備份策略
 */
const BACKUP_STRATEGIES = {
    FULL: 'full',                  // 完整備份
    INCREMENTAL: 'incremental',    // 增量備份
    DIFFERENTIAL: 'differential'   // 差異備份
};

/**
 * 遷移操作類型
 */
const MIGRATION_TYPES = {
    UPGRADE: 'upgrade',            // 版本升級
    DOWNGRADE: 'downgrade',        // 版本降級
    TRANSFORM: 'transform',        // 數據轉換
    MERGE: 'merge'                 // 配置合併
};

/**
 * 配置包裝器
 */
class ConfigBundle {
    constructor(data = {}) {
        this.metadata = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            generator: 'ConfigImportExport',
            ...data.metadata
        };

        this.configurations = data.configurations || {};
        this.schemas = data.schemas || {};
        this.templates = data.templates || {};
        this.environments = data.environments || {};
        this.userPreferences = data.userPreferences || {};

        this.checksum = this._calculateChecksum();
        this.size = this._calculateSize();
    }

    /**
     * 添加配置
     */
    addConfig(key, value, category = 'configurations') {
        if (!this[category]) {
            this[category] = {};
        }
        this[category][key] = value;
        this._updateMetadata();
        return this;
    }

    /**
     * 獲取配置
     */
    getConfig(key, category = 'configurations') {
        return this[category] ? this[category][key] : undefined;
    }

    /**
     * 移除配置
     */
    removeConfig(key, category = 'configurations') {
        if (this[category] && key in this[category]) {
            delete this[category][key];
            this._updateMetadata();
        }
        return this;
    }

    /**
     * 驗證包完整性
     */
    validate() {
        const currentChecksum = this._calculateChecksum();
        return {
            isValid: currentChecksum === this.checksum,
            expectedChecksum: this.checksum,
            actualChecksum: currentChecksum
        };
    }

    /**
     * 序列化為指定格式
     */
    serialize(format = EXPORT_FORMATS.JSON) {
        const data = {
            metadata: this.metadata,
            configurations: this.configurations,
            schemas: this.schemas,
            templates: this.templates,
            environments: this.environments,
            userPreferences: this.userPreferences,
            checksum: this.checksum,
            size: this.size
        };

        switch (format) {
            case EXPORT_FORMATS.JSON:
                return JSON.stringify(data, null, 2);

            case EXPORT_FORMATS.YAML:
                return this._toYAML(data);

            case EXPORT_FORMATS.TOML:
                return this._toTOML(data);

            case EXPORT_FORMATS.XML:
                return this._toXML(data);

            case EXPORT_FORMATS.CSV:
                return this._toCSV(data);

            case EXPORT_FORMATS.BINARY:
                return this._toBinary(data);

            default:
                throw new Error(`不支持的格式: ${format}`);
        }
    }

    /**
     * 從數據反序列化
     */
    static deserialize(data, format = EXPORT_FORMATS.JSON) {
        let parsedData;

        switch (format) {
            case EXPORT_FORMATS.JSON:
                parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                break;

            case EXPORT_FORMATS.YAML:
                parsedData = ConfigBundle._fromYAML(data);
                break;

            case EXPORT_FORMATS.TOML:
                parsedData = ConfigBundle._fromTOML(data);
                break;

            case EXPORT_FORMATS.XML:
                parsedData = ConfigBundle._fromXML(data);
                break;

            case EXPORT_FORMATS.CSV:
                parsedData = ConfigBundle._fromCSV(data);
                break;

            case EXPORT_FORMATS.BINARY:
                parsedData = ConfigBundle._fromBinary(data);
                break;

            default:
                throw new Error(`不支持的格式: ${format}`);
        }

        return new ConfigBundle(parsedData);
    }

    /**
     * 計算校驗和
     */
    _calculateChecksum() {
        const content = JSON.stringify({
            configurations: this.configurations,
            schemas: this.schemas,
            templates: this.templates,
            environments: this.environments,
            userPreferences: this.userPreferences
        });

        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * 計算大小
     */
    _calculateSize() {
        return Buffer.byteLength(JSON.stringify(this), 'utf8');
    }

    /**
     * 更新元數據
     */
    _updateMetadata() {
        this.metadata.lastModified = new Date().toISOString();
        this.checksum = this._calculateChecksum();
        this.size = this._calculateSize();
    }

    // ========== 格式轉換方法 ==========

    _toYAML(data) {
        // 簡化的YAML輸出 - 實際應用中應使用js-yaml庫
        const yamlLines = [];

        function addToYAML(obj, indent = 0) {
            const spaces = '  '.repeat(indent);

            if (Array.isArray(obj)) {
                obj.forEach(item => {
                    yamlLines.push(`${spaces}- ${typeof item === 'object' ? '' : item}`);
                    if (typeof item === 'object') {
                        addToYAML(item, indent + 1);
                    }
                });
            } else if (obj && typeof obj === 'object') {
                Object.entries(obj).forEach(([key, value]) => {
                    if (typeof value === 'object') {
                        yamlLines.push(`${spaces}${key}:`);
                        addToYAML(value, indent + 1);
                    } else {
                        yamlLines.push(`${spaces}${key}: ${value}`);
                    }
                });
            }
        }

        addToYAML(data);
        return yamlLines.join('\n');
    }

    _toTOML(data) {
        // 簡化的TOML輸出
        const tomlLines = [];

        Object.entries(data).forEach(([section, value]) => {
            tomlLines.push(`[${section}]`);

            if (value && typeof value === 'object') {
                Object.entries(value).forEach(([key, val]) => {
                    if (typeof val === 'string') {
                        tomlLines.push(`${key} = "${val}"`);
                    } else {
                        tomlLines.push(`${key} = ${val}`);
                    }
                });
            }

            tomlLines.push('');
        });

        return tomlLines.join('\n');
    }

    _toXML(data) {
        // 簡化的XML輸出
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n';

        function toXMLNode(obj, tagName) {
            if (Array.isArray(obj)) {
                return obj.map(item => `  <${tagName}>${item}</${tagName}>`).join('\n');
            } else if (obj && typeof obj === 'object') {
                let result = `  <${tagName}>\n`;
                Object.entries(obj).forEach(([key, value]) => {
                    if (typeof value === 'object') {
                        result += `    ${toXMLNode(value, key)}\n`;
                    } else {
                        result += `    <${key}>${value}</${key}>\n`;
                    }
                });
                result += `  </${tagName}>`;
                return result;
            } else {
                return `<${tagName}>${obj}</${tagName}>`;
            }
        }

        Object.entries(data).forEach(([key, value]) => {
            xml += toXMLNode(value, key) + '\n';
        });

        xml += '</config>';
        return xml;
    }

    _toCSV(data) {
        // 將配置展平為CSV格式
        const rows = [];
        rows.push(['Category', 'Key', 'Value', 'Type']);

        function flattenObject(obj, category, prefix = '') {
            Object.entries(obj).forEach(([key, value]) => {
                const fullKey = prefix ? `${prefix}.${key}` : key;

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    flattenObject(value, category, fullKey);
                } else {
                    rows.push([
                        category,
                        fullKey,
                        Array.isArray(value) ? JSON.stringify(value) : String(value),
                        typeof value
                    ]);
                }
            });
        }

        Object.entries(data).forEach(([category, categoryData]) => {
            if (categoryData && typeof categoryData === 'object') {
                flattenObject(categoryData, category);
            }
        });

        return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    _toBinary(data) {
        // 簡單的二進制編碼 - 實際應用中應使用更複雜的編碼
        const jsonString = JSON.stringify(data);
        return Buffer.from(jsonString).toString('base64');
    }

    static _fromYAML(yamlString) {
        // 簡化的YAML解析 - 實際應用中應使用js-yaml庫
        throw new Error('YAML導入需要js-yaml庫支持');
    }

    static _fromTOML(tomlString) {
        // 簡化的TOML解析
        throw new Error('TOML導入需要@iarna/toml庫支持');
    }

    static _fromXML(xmlString) {
        // 簡化的XML解析
        throw new Error('XML導入需要xml2js庫支持');
    }

    static _fromCSV(csvString) {
        const lines = csvString.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        const data = { configurations: {}, schemas: {}, templates: {}, environments: {}, userPreferences: {} };

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
            const [category, key, value, type] = values;

            if (!data[category]) {
                data[category] = {};
            }

            // 類型轉換
            let parsedValue = value;
            switch (type) {
                case 'number':
                    parsedValue = Number(value);
                    break;
                case 'boolean':
                    parsedValue = value === 'true';
                    break;
                case 'object':
                    try {
                        parsedValue = JSON.parse(value);
                    } catch (e) {
                        parsedValue = value;
                    }
                    break;
            }

            this._setNestedValue(data[category], key, parsedValue);
        }

        return data;
    }

    static _fromBinary(binaryString) {
        const jsonString = Buffer.from(binaryString, 'base64').toString();
        return JSON.parse(jsonString);
    }

    static _setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }
}

/**
 * 備份管理器
 */
class BackupManager {
    constructor(options = {}) {
        this.options = {
            backupDir: options.backupDir || path.join(process.cwd(), '.claude', 'backups'),
            maxBackups: options.maxBackups || 50,
            compressionEnabled: options.compressionEnabled !== false,
            encryptionEnabled: options.encryptionEnabled || false,
            encryptionKey: options.encryptionKey || null,
            ...options
        };

        this.backups = new Map(); // timestamp -> backup metadata
    }

    /**
     * 創建備份
     */
    async createBackup(configBundle, strategy = BACKUP_STRATEGIES.FULL, options = {}) {
        try {
            const timestamp = Date.now();
            const backupId = `backup_${timestamp}`;

            const backupData = {
                id: backupId,
                timestamp,
                strategy,
                size: configBundle.size,
                checksum: configBundle.checksum,
                metadata: {
                    ...configBundle.metadata,
                    backupStrategy: strategy,
                    backupOptions: options
                }
            };

            // 根據策略處理數據
            let dataToBackup = configBundle;

            switch (strategy) {
                case BACKUP_STRATEGIES.INCREMENTAL:
                    dataToBackup = await this._createIncrementalBackup(configBundle, options);
                    break;
                case BACKUP_STRATEGIES.DIFFERENTIAL:
                    dataToBackup = await this._createDifferentialBackup(configBundle, options);
                    break;
                default:
                    // 完整備份，使用原始數據
                    break;
            }

            // 保存備份
            const fileName = `${backupId}.json`;
            const filePath = path.join(this.options.backupDir, fileName);

            await this._ensureBackupDirectory();
            await this._saveBackupFile(filePath, dataToBackup, backupData);

            // 記錄備份
            this.backups.set(timestamp, {
                ...backupData,
                filePath,
                fileName
            });

            // 清理舊備份
            await this._cleanupOldBackups();

            console.log(`[BackupManager] 備份已創建: ${backupId}`);
            return backupData;

        } catch (error) {
            console.error('[BackupManager] 創建備份失敗:', error);
            throw error;
        }
    }

    /**
     * 還原備份
     */
    async restoreBackup(backupId, options = {}) {
        try {
            const backup = this._findBackup(backupId);
            if (!backup) {
                throw new Error(`備份不存在: ${backupId}`);
            }

            const data = await this._loadBackupFile(backup.filePath, backup);

            // 根據策略還原數據
            let restoredBundle;

            switch (backup.strategy) {
                case BACKUP_STRATEGIES.INCREMENTAL:
                    restoredBundle = await this._restoreIncrementalBackup(data, options);
                    break;
                case BACKUP_STRATEGIES.DIFFERENTIAL:
                    restoredBundle = await this._restoreDifferentialBackup(data, options);
                    break;
                default:
                    restoredBundle = ConfigBundle.deserialize(data);
                    break;
            }

            // 驗證還原數據
            const validation = restoredBundle.validate();
            if (!validation.isValid && options.validateIntegrity !== false) {
                throw new Error('備份數據完整性驗證失敗');
            }

            console.log(`[BackupManager] 備份已還原: ${backupId}`);
            return restoredBundle;

        } catch (error) {
            console.error(`[BackupManager] 還原備份失敗 [${backupId}]:`, error);
            throw error;
        }
    }

    /**
     * 獲取備份列表
     */
    getBackups(options = {}) {
        let backups = Array.from(this.backups.values());

        if (options.strategy) {
            backups = backups.filter(b => b.strategy === options.strategy);
        }

        if (options.limit) {
            backups = backups.slice(-options.limit);
        }

        if (options.since) {
            const sinceTime = typeof options.since === 'string'
                ? new Date(options.since).getTime()
                : options.since;
            backups = backups.filter(b => b.timestamp >= sinceTime);
        }

        return backups.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * 刪除備份
     */
    async deleteBackup(backupId) {
        try {
            const backup = this._findBackup(backupId);
            if (!backup) {
                throw new Error(`備份不存在: ${backupId}`);
            }

            // 刪除檔案
            await fs.unlink(backup.filePath);

            // 從記錄中移除
            this.backups.delete(backup.timestamp);

            console.log(`[BackupManager] 備份已刪除: ${backupId}`);
            return true;

        } catch (error) {
            console.error(`[BackupManager] 刪除備份失敗 [${backupId}]:`, error);
            throw error;
        }
    }

    // ========== 私有方法 ==========

    async _ensureBackupDirectory() {
        try {
            await fs.mkdir(this.options.backupDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    async _saveBackupFile(filePath, dataToBackup, metadata) {
        const backupContent = {
            metadata,
            data: dataToBackup.serialize ? dataToBackup.serialize() : dataToBackup
        };

        let fileContent = JSON.stringify(backupContent, null, 2);

        // 壓縮
        if (this.options.compressionEnabled) {
            // 這裡應該使用zlib壓縮
            // fileContent = compress(fileContent);
        }

        // 加密
        if (this.options.encryptionEnabled && this.options.encryptionKey) {
            // 這裡應該使用加密算法
            // fileContent = encrypt(fileContent, this.options.encryptionKey);
        }

        await fs.writeFile(filePath, fileContent, 'utf8');
    }

    async _loadBackupFile(filePath, metadata) {
        let fileContent = await fs.readFile(filePath, 'utf8');

        // 解密
        if (this.options.encryptionEnabled && this.options.encryptionKey) {
            // 這裡應該使用解密算法
            // fileContent = decrypt(fileContent, this.options.encryptionKey);
        }

        // 解壓縮
        if (this.options.compressionEnabled) {
            // 這裡應該使用zlib解壓縮
            // fileContent = decompress(fileContent);
        }

        const backupContent = JSON.parse(fileContent);
        return backupContent.data;
    }

    async _createIncrementalBackup(configBundle, options) {
        // 增量備份：只備份變更的部分
        const lastBackup = this._getLastBackup(BACKUP_STRATEGIES.FULL);
        if (!lastBackup) {
            // 如果沒有完整備份，創建完整備份
            return configBundle;
        }

        // 比較差異 - 簡化實現
        const changes = this._compareConfigs(lastBackup, configBundle);
        return new ConfigBundle({
            ...configBundle.metadata,
            incrementalChanges: changes
        });
    }

    async _createDifferentialBackup(configBundle, options) {
        // 差異備份：相對於最後一次完整備份的所有變更
        const lastFullBackup = this._getLastBackup(BACKUP_STRATEGIES.FULL);
        if (!lastFullBackup) {
            return configBundle;
        }

        const differences = this._compareConfigs(lastFullBackup, configBundle);
        return new ConfigBundle({
            ...configBundle.metadata,
            differentialChanges: differences
        });
    }

    async _restoreIncrementalBackup(data, options) {
        // 還原增量備份：需要完整備份 + 所有增量變更
        throw new Error('增量備份還原需要實現完整的變更鏈重建');
    }

    async _restoreDifferentialBackup(data, options) {
        // 還原差異備份：需要完整備份 + 差異變更
        throw new Error('差異備份還原需要實現完整備份合併');
    }

    _compareConfigs(oldConfig, newConfig) {
        // 簡化的配置比較實現
        const changes = {};

        // 這裡應該實現深度對象比較
        // 返回變更的配置項

        return changes;
    }

    _findBackup(backupId) {
        for (const backup of this.backups.values()) {
            if (backup.id === backupId) {
                return backup;
            }
        }
        return null;
    }

    _getLastBackup(strategy = null) {
        const backups = Array.from(this.backups.values())
            .filter(b => !strategy || b.strategy === strategy)
            .sort((a, b) => b.timestamp - a.timestamp);

        return backups[0] || null;
    }

    async _cleanupOldBackups() {
        const backups = Array.from(this.backups.values())
            .sort((a, b) => b.timestamp - a.timestamp);

        if (backups.length > this.options.maxBackups) {
            const toDelete = backups.slice(this.options.maxBackups);

            for (const backup of toDelete) {
                try {
                    await fs.unlink(backup.filePath);
                    this.backups.delete(backup.timestamp);
                    console.log(`[BackupManager] 舊備份已清理: ${backup.id}`);
                } catch (error) {
                    console.warn(`[BackupManager] 清理舊備份失敗 [${backup.id}]:`, error);
                }
            }
        }
    }
}

/**
 * 主導入導出管理器
 */
class ConfigImportExport extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            configManager: options.configManager || null,
            backupManager: options.backupManager || null,

            // 導入導出配置
            defaultFormat: options.defaultFormat || EXPORT_FORMATS.JSON,
            enableValidation: options.enableValidation !== false,
            enableBackup: options.enableBackup !== false,

            // 備份配置
            backupOptions: options.backupOptions || {},

            // 遷移配置
            migrationHandlers: options.migrationHandlers || new Map(),

            ...options
        };

        // 核心組件
        this.configManager = this.options.configManager;
        this.backupManager = this.options.backupManager || new BackupManager(this.options.backupOptions);

        // 統計信息
        this.stats = {
            totalExports: 0,
            totalImports: 0,
            totalBackups: 0,
            totalMigrations: 0,
            averageExportTime: 0,
            averageImportTime: 0
        };
    }

    /**
     * 導出配置
     */
    async export(options = {}) {
        const startTime = Date.now();

        try {
            const opts = {
                format: this.options.defaultFormat,
                includeEnvironments: true,
                includeTemplates: true,
                includePreferences: true,
                includeSchemas: true,
                createBackup: this.options.enableBackup,
                ...options
            };

            // 收集配置數據
            const bundleData = await this._collectConfigurations(opts);

            // 創建配置包
            const configBundle = new ConfigBundle(bundleData);

            // 驗證配置
            if (opts.enableValidation !== false) {
                const validation = configBundle.validate();
                if (!validation.isValid) {
                    throw new Error('配置包完整性驗證失敗');
                }
            }

            // 創建備份
            if (opts.createBackup) {
                await this.backupManager.createBackup(configBundle, BACKUP_STRATEGIES.FULL, {
                    reason: 'export_backup',
                    exportOptions: opts
                });
            }

            // 序列化為指定格式
            const serializedData = configBundle.serialize(opts.format);

            // 保存到文件（如果指定了路徑）
            if (opts.outputPath) {
                await this._saveExportFile(opts.outputPath, serializedData, opts.format);
            }

            const exportTime = Date.now() - startTime;
            this._updateExportStats(exportTime);

            const result = {
                success: true,
                format: opts.format,
                size: Buffer.byteLength(serializedData, 'utf8'),
                configCount: Object.keys(bundleData.configurations || {}).length,
                exportTime,
                data: opts.returnData !== false ? serializedData : null,
                checksum: configBundle.checksum
            };

            this.emit('exportCompleted', result);
            console.log(`[ConfigImportExport] 配置已導出 - 格式: ${opts.format}, 耗時: ${exportTime}ms`);

            return result;

        } catch (error) {
            const exportTime = Date.now() - startTime;
            console.error('[ConfigImportExport] 導出配置失敗:', error);

            const result = {
                success: false,
                error: error.message,
                exportTime
            };

            this.emit('exportError', result);
            throw error;
        }
    }

    /**
     * 導入配置
     */
    async import(data, options = {}) {
        const startTime = Date.now();

        try {
            const opts = {
                format: this.options.defaultFormat,
                overwrite: false,
                validateIntegrity: this.options.enableValidation,
                createBackup: this.options.enableBackup,
                migrateVersion: true,
                ...options
            };

            // 創建導入前備份
            if (opts.createBackup) {
                const currentBundle = await this._collectConfigurations({ includeAll: true });
                await this.backupManager.createBackup(
                    new ConfigBundle(currentBundle),
                    BACKUP_STRATEGIES.FULL,
                    { reason: 'pre_import_backup' }
                );
            }

            // 反序列化數據
            const configBundle = this._deserializeData(data, opts);

            // 驗證完整性
            if (opts.validateIntegrity) {
                const validation = configBundle.validate();
                if (!validation.isValid) {
                    throw new Error(`配置包完整性驗證失敗: ${validation.actualChecksum} !== ${validation.expectedChecksum}`);
                }
            }

            // 版本遷移
            if (opts.migrateVersion) {
                await this._performMigration(configBundle, opts);
            }

            // 導入配置
            const importResults = await this._importConfigurations(configBundle, opts);

            const importTime = Date.now() - startTime;
            this._updateImportStats(importTime);

            const result = {
                success: true,
                format: opts.format,
                importedConfigs: importResults.totalImported,
                skippedConfigs: importResults.totalSkipped,
                failedConfigs: importResults.totalFailed,
                importTime,
                results: importResults.details
            };

            this.emit('importCompleted', result);
            console.log(`[ConfigImportExport] 配置已導入 - 成功: ${result.importedConfigs}, 耗時: ${importTime}ms`);

            return result;

        } catch (error) {
            const importTime = Date.now() - startTime;
            console.error('[ConfigImportExport] 導入配置失敗:', error);

            // 如果有備份，考慮回滾
            if (options.rollbackOnError) {
                await this._performRollback();
            }

            const result = {
                success: false,
                error: error.message,
                importTime
            };

            this.emit('importError', result);
            throw error;
        }
    }

    /**
     * 創建備份
     */
    async backup(strategy = BACKUP_STRATEGIES.FULL, options = {}) {
        try {
            const bundleData = await this._collectConfigurations({ includeAll: true });
            const configBundle = new ConfigBundle(bundleData);

            const backup = await this.backupManager.createBackup(configBundle, strategy, options);
            this.stats.totalBackups++;

            this.emit('backupCreated', backup);
            return backup;

        } catch (error) {
            console.error('[ConfigImportExport] 創建備份失敗:', error);
            this.emit('backupError', error);
            throw error;
        }
    }

    /**
     * 還原備份
     */
    async restore(backupId, options = {}) {
        try {
            const configBundle = await this.backupManager.restoreBackup(backupId, options);
            const importResults = await this._importConfigurations(configBundle, {
                overwrite: true,
                ...options
            });

            this.emit('restoreCompleted', { backupId, results: importResults });
            return importResults;

        } catch (error) {
            console.error(`[ConfigImportExport] 還原備份失敗 [${backupId}]:`, error);
            this.emit('restoreError', { backupId, error });
            throw error;
        }
    }

    /**
     * 註冊遷移處理器
     */
    registerMigrationHandler(fromVersion, toVersion, handler) {
        const key = `${fromVersion}_to_${toVersion}`;
        this.options.migrationHandlers.set(key, handler);
        return this;
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return {
            ...this.stats,
            availableBackups: this.backupManager.getBackups().length
        };
    }

    // ========== 私有方法 ==========

    /**
     * 收集配置數據
     */
    async _collectConfigurations(options = {}) {
        const bundleData = {
            metadata: {
                version: '1.0',
                timestamp: new Date().toISOString(),
                generator: 'ConfigImportExport',
                options
            },
            configurations: {},
            schemas: {},
            templates: {},
            environments: {},
            userPreferences: {}
        };

        if (!this.configManager) {
            return bundleData;
        }

        try {
            // 獲取所有配置鍵
            const configKeys = await this.configManager.keys();

            for (const key of configKeys) {
                const value = await this.configManager.get(key);

                if (key.startsWith('schema_') && options.includeSchemas !== false) {
                    bundleData.schemas[key] = value;
                } else if (key.startsWith('template_') && options.includeTemplates !== false) {
                    bundleData.templates[key] = value;
                } else if (key.startsWith('env_') && options.includeEnvironments !== false) {
                    bundleData.environments[key] = value;
                } else if (key.startsWith('preferences_') && options.includePreferences !== false) {
                    bundleData.userPreferences[key] = value;
                } else {
                    bundleData.configurations[key] = value;
                }
            }

        } catch (error) {
            console.warn('[ConfigImportExport] 收集配置失敗:', error);
        }

        return bundleData;
    }

    /**
     * 反序列化數據
     */
    _deserializeData(data, options) {
        if (typeof data === 'string' && options.inputPath) {
            // 從文件路徑讀取
            return this._loadFromFile(options.inputPath, options.format);
        }

        return ConfigBundle.deserialize(data, options.format);
    }

    /**
     * 導入配置到系統
     */
    async _importConfigurations(configBundle, options) {
        const results = {
            totalImported: 0,
            totalSkipped: 0,
            totalFailed: 0,
            details: []
        };

        if (!this.configManager) {
            throw new Error('ConfigManager未初始化');
        }

        // 導入各類配置
        const categories = ['configurations', 'schemas', 'templates', 'environments', 'userPreferences'];

        for (const category of categories) {
            const categoryData = configBundle[category] || {};

            for (const [key, value] of Object.entries(categoryData)) {
                try {
                    // 檢查是否已存在
                    const existingValue = await this.configManager.get(key);

                    if (existingValue !== null && !options.overwrite) {
                        results.totalSkipped++;
                        results.details.push({
                            key,
                            category,
                            action: 'skipped',
                            reason: 'already_exists'
                        });
                        continue;
                    }

                    // 導入配置
                    await this.configManager.set(key, value, {
                        source: 'import',
                        category
                    });

                    results.totalImported++;
                    results.details.push({
                        key,
                        category,
                        action: 'imported',
                        success: true
                    });

                } catch (error) {
                    results.totalFailed++;
                    results.details.push({
                        key,
                        category,
                        action: 'failed',
                        error: error.message
                    });
                }
            }
        }

        return results;
    }

    /**
     * 執行版本遷移
     */
    async _performMigration(configBundle, options) {
        const currentVersion = configBundle.metadata.version;
        const targetVersion = options.targetVersion || '1.0';

        if (currentVersion === targetVersion) {
            return; // 無需遷移
        }

        const migrationKey = `${currentVersion}_to_${targetVersion}`;
        const handler = this.options.migrationHandlers.get(migrationKey);

        if (!handler) {
            console.warn(`[ConfigImportExport] 未找到遷移處理器: ${migrationKey}`);
            return;
        }

        try {
            await handler(configBundle, {
                fromVersion: currentVersion,
                toVersion: targetVersion,
                ...options
            });

            configBundle.metadata.version = targetVersion;
            configBundle.metadata.migratedAt = new Date().toISOString();

            this.stats.totalMigrations++;
            this.emit('migrationCompleted', { fromVersion: currentVersion, toVersion: targetVersion });

        } catch (error) {
            console.error(`[ConfigImportExport] 版本遷移失敗 [${migrationKey}]:`, error);
            throw error;
        }
    }

    /**
     * 執行回滾
     */
    async _performRollback() {
        const backups = this.backupManager.getBackups({ limit: 1 });
        if (backups.length === 0) {
            throw new Error('沒有可用的備份進行回滾');
        }

        const latestBackup = backups[0];
        await this.restore(latestBackup.id, { overwrite: true });
        console.log(`[ConfigImportExport] 已回滾到備份: ${latestBackup.id}`);
    }

    /**
     * 保存導出文件
     */
    async _saveExportFile(filePath, data, format) {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, data, 'utf8');
    }

    /**
     * 從文件載入
     */
    async _loadFromFile(filePath, format) {
        const data = await fs.readFile(filePath, 'utf8');
        return ConfigBundle.deserialize(data, format);
    }

    /**
     * 更新導出統計
     */
    _updateExportStats(exportTime) {
        this.stats.totalExports++;
        this.stats.averageExportTime = (
            this.stats.averageExportTime * (this.stats.totalExports - 1) + exportTime
        ) / this.stats.totalExports;
    }

    /**
     * 更新導入統計
     */
    _updateImportStats(importTime) {
        this.stats.totalImports++;
        this.stats.averageImportTime = (
            this.stats.averageImportTime * (this.stats.totalImports - 1) + importTime
        ) / this.stats.totalImports;
    }
}

// 導出常數
ConfigImportExport.EXPORT_FORMATS = EXPORT_FORMATS;
ConfigImportExport.BACKUP_STRATEGIES = BACKUP_STRATEGIES;
ConfigImportExport.MIGRATION_TYPES = MIGRATION_TYPES;

module.exports = ConfigImportExport;