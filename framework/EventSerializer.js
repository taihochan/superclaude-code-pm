/**
 * EventSerializer - 事件序列化和反序列化處理器
 *
 * 功能：
 * - 事件數據的序列化和反序列化
 * - 支持JSON格式和壓縮
 * - 處理循環引用和複雜對象
 * - 提供性能優化的序列化選項
 *
 * 用途：在EventBus和EventStore中處理事件數據的序列化需求
 */

const crypto = require('crypto');
const zlib = require('zlib');

class EventSerializer {
    constructor(options = {}) {
        this.options = {
            enableCompression: options.enableCompression || false,
            enableEncryption: options.enableEncryption || false,
            encryptionKey: options.encryptionKey || null,
            maxDepth: options.maxDepth || 10,
            includeMetadata: options.includeMetadata !== false,
            ...options
        };

        // 處理循環引用的WeakMap
        this.circularRefs = new WeakMap();

        // 性能統計
        this.stats = {
            serialized: 0,
            deserialized: 0,
            compressionRatio: 0,
            errors: 0
        };
    }

    /**
     * 序列化事件對象
     * @param {Object} event - 要序列化的事件對象
     * @param {Object} options - 序列化選項
     * @returns {Promise<String>} 序列化後的字符串
     */
    async serialize(event, options = {}) {
        try {
            const startTime = Date.now();
            const mergedOptions = { ...this.options, ...options };

            // 添加元數據
            let eventWithMeta = event;
            if (mergedOptions.includeMetadata) {
                eventWithMeta = {
                    ...event,
                    __meta: {
                        version: '1.0',
                        serializedAt: new Date().toISOString(),
                        serializer: 'EventSerializer'
                    }
                };
            }

            // 處理循環引用並序列化
            const jsonString = this._serializeWithCircularHandling(eventWithMeta);

            let result = jsonString;

            // 壓縮處理
            if (mergedOptions.enableCompression) {
                result = await this._compress(result);
            }

            // 加密處理
            if (mergedOptions.enableEncryption && mergedOptions.encryptionKey) {
                result = await this._encrypt(result, mergedOptions.encryptionKey);
            }

            // 更新統計信息
            this.stats.serialized++;
            const processingTime = Date.now() - startTime;

            if (mergedOptions.enableCompression) {
                this.stats.compressionRatio = jsonString.length / result.length;
            }

            return result;

        } catch (error) {
            this.stats.errors++;
            throw new Error(`序列化失敗: ${error.message}`);
        }
    }

    /**
     * 反序列化事件字符串
     * @param {String} serializedEvent - 序列化的事件字符串
     * @param {Object} options - 反序列化選項
     * @returns {Promise<Object>} 反序列化後的事件對象
     */
    async deserialize(serializedEvent, options = {}) {
        try {
            const startTime = Date.now();
            const mergedOptions = { ...this.options, ...options };

            let data = serializedEvent;

            // 解密處理
            if (mergedOptions.enableEncryption && mergedOptions.encryptionKey) {
                data = await this._decrypt(data, mergedOptions.encryptionKey);
            }

            // 解壓縮處理
            if (mergedOptions.enableCompression) {
                data = await this._decompress(data);
            }

            // JSON解析
            const event = JSON.parse(data);

            // 處理元數據
            if (event.__meta && mergedOptions.includeMetadata) {
                // 可以在這裡添加版本兼容性檢查
                delete event.__meta;
            }

            // 更新統計信息
            this.stats.deserialized++;
            const processingTime = Date.now() - startTime;

            return event;

        } catch (error) {
            this.stats.errors++;
            throw new Error(`反序列化失敗: ${error.message}`);
        }
    }

    /**
     * 處理循環引用的序列化
     * @private
     */
    _serializeWithCircularHandling(obj, depth = 0) {
        if (depth > this.options.maxDepth) {
            return '[Deep Object]';
        }

        // 處理null和undefined
        if (obj === null || obj === undefined) {
            return JSON.stringify(obj);
        }

        // 處理基本類型
        if (typeof obj !== 'object') {
            return JSON.stringify(obj);
        }

        // 處理數組
        if (Array.isArray(obj)) {
            return '[' + obj.map(item =>
                this._serializeWithCircularHandling(item, depth + 1)
            ).join(',') + ']';
        }

        // 處理循環引用
        if (this.circularRefs.has(obj)) {
            return '"[Circular Reference]"';
        }

        this.circularRefs.set(obj, true);

        try {
            // 處理對象
            const pairs = [];
            for (const [key, value] of Object.entries(obj)) {
                const serializedValue = this._serializeWithCircularHandling(value, depth + 1);
                pairs.push(`"${key}":${serializedValue}`);
            }

            return '{' + pairs.join(',') + '}';
        } finally {
            this.circularRefs.delete(obj);
        }
    }

    /**
     * 壓縮數據
     * @private
     */
    async _compress(data) {
        return new Promise((resolve, reject) => {
            zlib.gzip(data, (error, compressed) => {
                if (error) reject(error);
                else resolve(compressed.toString('base64'));
            });
        });
    }

    /**
     * 解壓縮數據
     * @private
     */
    async _decompress(compressedData) {
        return new Promise((resolve, reject) => {
            const buffer = Buffer.from(compressedData, 'base64');
            zlib.gunzip(buffer, (error, decompressed) => {
                if (error) reject(error);
                else resolve(decompressed.toString());
            });
        });
    }

    /**
     * 加密數據
     * @private
     */
    async _encrypt(data, key) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, key);

        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encrypted,
            iv: iv.toString('hex'),
            algorithm
        };
    }

    /**
     * 解密數據
     * @private
     */
    async _decrypt(encryptedData, key) {
        const { encrypted, iv, algorithm } = encryptedData;
        const decipher = crypto.createDecipher(algorithm, key);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * 獲取性能統計信息
     * @returns {Object} 統計信息
     */
    getStats() {
        return {
            ...this.stats,
            averageCompressionRatio: this.stats.compressionRatio,
            errorRate: this.stats.errors / (this.stats.serialized + this.stats.deserialized) || 0
        };
    }

    /**
     * 重置統計信息
     */
    resetStats() {
        this.stats = {
            serialized: 0,
            deserialized: 0,
            compressionRatio: 0,
            errors: 0
        };
    }

    /**
     * 驗證事件對象格式
     * @param {Object} event - 要驗證的事件對象
     * @returns {Boolean} 是否有效
     */
    validateEvent(event) {
        if (!event || typeof event !== 'object') {
            return false;
        }

        // 必需字段檢查
        const requiredFields = ['type', 'timestamp'];
        for (const field of requiredFields) {
            if (!(field in event)) {
                return false;
            }
        }

        // 時間戳格式檢查
        if (!(event.timestamp instanceof Date) && !Date.parse(event.timestamp)) {
            return false;
        }

        return true;
    }

    /**
     * 清理資源
     */
    dispose() {
        this.circularRefs.clear();
        this.resetStats();
    }
}

module.exports = EventSerializer;