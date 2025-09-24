/**
 * 驗證中間件 - 統一命令路由系統
 *
 * 功能：
 * - 驗證命令參數和標記
 * - 類型檢查和格式驗證
 * - 參數範圍和約束驗證
 * - 自定義驗證規則支援
 * - 提供詳細的驗證錯誤信息
 */

// 驗證類型
export const VALIDATION_TYPES = {
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
    EMAIL: 'email',
    URL: 'url',
    UUID: 'uuid',
    DATE: 'date',
    ENUM: 'enum',
    REGEX: 'regex',
    CUSTOM: 'custom'
};

// 驗證錯誤
export class ValidationError extends Error {
    constructor(message, code, field = null, value = null) {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
        this.field = field;
        this.value = value;
        this.details = [];
    }

    addDetail(field, message, value) {
        this.details.push({
            field,
            message,
            value: value !== undefined ? value : null
        });
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            field: this.field,
            value: this.value,
            details: this.details
        };
    }
}

// 內建驗證器
export class Validators {
    // 字符串驗證
    static string(value, constraints = {}) {
        if (typeof value !== 'string') {
            throw new ValidationError(`值必須是字符串`, 'INVALID_TYPE', null, value);
        }

        if (constraints.minLength && value.length < constraints.minLength) {
            throw new ValidationError(
                `字符串長度不能少於 ${constraints.minLength} 個字符`,
                'MIN_LENGTH',
                null,
                value
            );
        }

        if (constraints.maxLength && value.length > constraints.maxLength) {
            throw new ValidationError(
                `字符串長度不能超過 ${constraints.maxLength} 個字符`,
                'MAX_LENGTH',
                null,
                value
            );
        }

        if (constraints.pattern && !constraints.pattern.test(value)) {
            throw new ValidationError(
                `字符串格式不匹配要求的模式`,
                'PATTERN_MISMATCH',
                null,
                value
            );
        }

        return value;
    }

    // 數字驗證
    static number(value, constraints = {}) {
        const num = typeof value === 'string' ? parseFloat(value) : value;

        if (typeof num !== 'number' || isNaN(num)) {
            throw new ValidationError(`值必須是有效數字`, 'INVALID_NUMBER', null, value);
        }

        if (constraints.min !== undefined && num < constraints.min) {
            throw new ValidationError(
                `數值不能小於 ${constraints.min}`,
                'MIN_VALUE',
                null,
                value
            );
        }

        if (constraints.max !== undefined && num > constraints.max) {
            throw new ValidationError(
                `數值不能大於 ${constraints.max}`,
                'MAX_VALUE',
                null,
                value
            );
        }

        if (constraints.multipleOf && num % constraints.multipleOf !== 0) {
            throw new ValidationError(
                `數值必須是 ${constraints.multipleOf} 的倍數`,
                'MULTIPLE_OF',
                null,
                value
            );
        }

        return num;
    }

    // 整數驗證
    static integer(value, constraints = {}) {
        const num = this.number(value, constraints);

        if (!Number.isInteger(num)) {
            throw new ValidationError(`值必須是整數`, 'INVALID_INTEGER', null, value);
        }

        return num;
    }

    // 布爾值驗證
    static boolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (['true', '1', 'yes', 'on'].includes(lower)) return true;
            if (['false', '0', 'no', 'off'].includes(lower)) return false;
        }

        throw new ValidationError(`值必須是布爾值`, 'INVALID_BOOLEAN', null, value);
    }

    // 數組驗證
    static array(value, constraints = {}) {
        if (!Array.isArray(value)) {
            throw new ValidationError(`值必須是數組`, 'INVALID_ARRAY', null, value);
        }

        if (constraints.minItems && value.length < constraints.minItems) {
            throw new ValidationError(
                `數組元素不能少於 ${constraints.minItems} 個`,
                'MIN_ITEMS',
                null,
                value
            );
        }

        if (constraints.maxItems && value.length > constraints.maxItems) {
            throw new ValidationError(
                `數組元素不能超過 ${constraints.maxItems} 個`,
                'MAX_ITEMS',
                null,
                value
            );
        }

        if (constraints.uniqueItems && new Set(value).size !== value.length) {
            throw new ValidationError(
                `數組元素必須是唯一的`,
                'UNIQUE_ITEMS',
                null,
                value
            );
        }

        return value;
    }

    // 枚舉驗證
    static enum(value, allowedValues) {
        if (!allowedValues.includes(value)) {
            throw new ValidationError(
                `值必須是以下之一: ${allowedValues.join(', ')}`,
                'INVALID_ENUM',
                null,
                value
            );
        }

        return value;
    }

    // 電子郵件驗證
    static email(value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            throw new ValidationError(`無效的電子郵件格式`, 'INVALID_EMAIL', null, value);
        }

        return value;
    }

    // URL驗證
    static url(value) {
        try {
            new URL(value);
            return value;
        } catch {
            throw new ValidationError(`無效的URL格式`, 'INVALID_URL', null, value);
        }
    }

    // UUID驗證
    static uuid(value) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(value)) {
            throw new ValidationError(`無效的UUID格式`, 'INVALID_UUID', null, value);
        }

        return value;
    }

    // 日期驗證
    static date(value) {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            throw new ValidationError(`無效的日期格式`, 'INVALID_DATE', null, value);
        }

        return date;
    }

    // 正則表達式驗證
    static regex(value, pattern, patternName = '模式') {
        if (!pattern.test(value)) {
            throw new ValidationError(
                `值不匹配 ${patternName} 格式要求`,
                'PATTERN_MISMATCH',
                null,
                value
            );
        }

        return value;
    }
}

// 參數驗證器
export class ParameterValidator {
    constructor(schema) {
        this.schema = schema;
    }

    validate(value, name = 'parameter') {
        if (this.schema.required && (value === undefined || value === null)) {
            throw new ValidationError(
                `參數 "${name}" 是必需的`,
                'REQUIRED_PARAMETER',
                name
            );
        }

        if (value === undefined || value === null) {
            return this.schema.default;
        }

        return this._validateType(value, this.schema, name);
    }

    _validateType(value, schema, name) {
        const { type, constraints = {} } = schema;

        try {
            switch (type) {
                case VALIDATION_TYPES.STRING:
                    return Validators.string(value, constraints);
                case VALIDATION_TYPES.NUMBER:
                    return Validators.number(value, constraints);
                case VALIDATION_TYPES.INTEGER:
                    return Validators.integer(value, constraints);
                case VALIDATION_TYPES.BOOLEAN:
                    return Validators.boolean(value);
                case VALIDATION_TYPES.ARRAY:
                    return Validators.array(value, constraints);
                case VALIDATION_TYPES.EMAIL:
                    return Validators.email(value);
                case VALIDATION_TYPES.URL:
                    return Validators.url(value);
                case VALIDATION_TYPES.UUID:
                    return Validators.uuid(value);
                case VALIDATION_TYPES.DATE:
                    return Validators.date(value);
                case VALIDATION_TYPES.ENUM:
                    return Validators.enum(value, constraints.values);
                case VALIDATION_TYPES.REGEX:
                    return Validators.regex(value, constraints.pattern, constraints.patternName);
                case VALIDATION_TYPES.CUSTOM:
                    if (!constraints.validator) {
                        throw new ValidationError(
                            `自定義驗證器缺少validator函數`,
                            'MISSING_VALIDATOR'
                        );
                    }
                    return constraints.validator(value, constraints.options || {});
                default:
                    throw new ValidationError(
                        `不支持的驗證類型: ${type}`,
                        'UNSUPPORTED_TYPE',
                        name
                    );
            }
        } catch (error) {
            if (error instanceof ValidationError) {
                error.field = name;
                throw error;
            }
            throw new ValidationError(
                `驗證參數 "${name}" 時發生錯誤: ${error.message}`,
                'VALIDATION_ERROR',
                name,
                value
            );
        }
    }
}

// 命令驗證器
export class CommandValidator {
    constructor(commandSchema) {
        this.commandSchema = commandSchema;
    }

    validate(parsedCommand) {
        const errors = new ValidationError('命令驗證失敗', 'COMMAND_VALIDATION_FAILED');
        const validatedData = {
            arguments: [],
            flags: {}
        };

        try {
            // 驗證參數
            if (this.commandSchema.parameters) {
                validatedData.arguments = this._validateParameters(
                    parsedCommand.arguments,
                    this.commandSchema.parameters
                );
            }

            // 驗證標記
            if (this.commandSchema.flags) {
                validatedData.flags = this._validateFlags(
                    parsedCommand.flags,
                    this.commandSchema.flags
                );
            }

            // 自定義命令驗證
            if (this.commandSchema.customValidator) {
                const customResult = this.commandSchema.customValidator({
                    ...parsedCommand,
                    validatedArguments: validatedData.arguments,
                    validatedFlags: validatedData.flags
                });

                if (!customResult.valid) {
                    errors.addDetail(
                        'custom',
                        customResult.message || '自定義驗證失敗',
                        parsedCommand
                    );
                }
            }

            if (errors.details.length > 0) {
                throw errors;
            }

            return validatedData;

        } catch (error) {
            if (error instanceof ValidationError && error.details.length > 0) {
                throw error;
            }

            // 單個驗證錯誤
            errors.addDetail(
                error.field || 'unknown',
                error.message,
                error.value
            );
            throw errors;
        }
    }

    _validateParameters(args, parameterSchemas) {
        const validatedArgs = [];

        parameterSchemas.forEach((schema, index) => {
            const validator = new ParameterValidator(schema);
            const value = args[index];

            try {
                const validatedValue = validator.validate(value, schema.name || `arg${index}`);
                validatedArgs.push(validatedValue);
            } catch (error) {
                throw error;
            }
        });

        // 檢查多餘的參數
        if (args.length > parameterSchemas.length && !this.commandSchema.allowExtraArgs) {
            throw new ValidationError(
                `命令接收到多餘的參數`,
                'EXTRA_ARGUMENTS',
                'arguments',
                args.slice(parameterSchemas.length)
            );
        }

        return validatedArgs;
    }

    _validateFlags(flags, flagSchemas) {
        const validatedFlags = {};

        // 驗證已定義的標記
        flagSchemas.forEach(schema => {
            const validator = new ParameterValidator(schema);
            const value = flags[schema.name];

            try {
                const validatedValue = validator.validate(value, schema.name);
                if (validatedValue !== undefined) {
                    validatedFlags[schema.name] = validatedValue;
                }
            } catch (error) {
                throw error;
            }
        });

        // 檢查未定義的標記
        if (!this.commandSchema.allowExtraFlags) {
            const definedFlagNames = new Set(flagSchemas.map(s => s.name));
            const unknownFlags = Object.keys(flags).filter(name => !definedFlagNames.has(name));

            if (unknownFlags.length > 0) {
                throw new ValidationError(
                    `未知的標記: ${unknownFlags.join(', ')}`,
                    'UNKNOWN_FLAGS',
                    'flags',
                    unknownFlags
                );
            }
        }

        return validatedFlags;
    }
}

/**
 * 創建驗證中間件
 * @param {Object} options - 驗證選項
 * @returns {Function} 中間件函數
 */
export function createValidationMiddleware(options = {}) {
    const {
        validateOnParse = true,
        allowPartialValidation = false,
        collectAllErrors = true
    } = options;

    return async function validationMiddleware(data) {
        if (!validateOnParse || !data.parsed) {
            return;
        }

        const { parsed, context } = data;

        try {
            // 從命令註冊表獲取驗證模式
            const commandDefinition = context.registry?.get(parsed.fullCommand);

            if (!commandDefinition || !commandDefinition.validation) {
                // 沒有驗證模式，跳過驗證
                return;
            }

            // 創建命令驗證器
            const validator = new CommandValidator(commandDefinition.validation);

            // 執行驗證
            const validatedData = validator.validate(parsed);

            // 將驗證後的數據附加到解析結果
            parsed.validatedArguments = validatedData.arguments;
            parsed.validatedFlags = validatedData.flags;

            // 標記為已驗證
            parsed.validated = true;

            console.log(`[Validation] 命令驗證成功: ${parsed.fullCommand}`);

        } catch (error) {
            if (error instanceof ValidationError) {
                console.error(`[Validation] 命令驗證失敗: ${parsed.fullCommand}`, error.toJSON());

                if (!allowPartialValidation) {
                    throw error;
                }

                // 部分驗證模式：記錄錯誤但不中斷執行
                parsed.validationErrors = error.details;
                parsed.validated = false;
            } else {
                console.error(`[Validation] 驗證過程中發生未知錯誤:`, error.message);
                throw error;
            }
        }
    };
}

/**
 * 創建自定義驗證器
 * @param {Function} validatorFn - 驗證函數
 * @param {string} errorMessage - 錯誤消息
 * @returns {Object} 自定義驗證器配置
 */
export function createCustomValidator(validatorFn, errorMessage = '自定義驗證失敗') {
    return {
        type: VALIDATION_TYPES.CUSTOM,
        constraints: {
            validator: (value, options) => {
                const result = validatorFn(value, options);
                if (!result) {
                    throw new ValidationError(errorMessage, 'CUSTOM_VALIDATION_FAILED', null, value);
                }
                return value;
            }
        }
    };
}

// 預定義的驗證模式
export const commonValidationSchemas = {
    // 文件路徑
    filePath: {
        type: VALIDATION_TYPES.STRING,
        constraints: {
            pattern: /^[^\s<>:"|?*]+$/,
            minLength: 1,
            maxLength: 260
        }
    },

    // 端口號
    port: {
        type: VALIDATION_TYPES.INTEGER,
        constraints: {
            min: 1,
            max: 65535
        }
    },

    // 時間間隔（毫秒）
    timeout: {
        type: VALIDATION_TYPES.INTEGER,
        constraints: {
            min: 0,
            max: 300000 // 5分鐘最大
        }
    },

    // 日誌級別
    logLevel: {
        type: VALIDATION_TYPES.ENUM,
        constraints: {
            values: ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
        }
    },

    // 命令格式
    commandFormat: {
        type: VALIDATION_TYPES.ENUM,
        constraints: {
            values: ['json', 'yaml', 'text', 'table']
        }
    }
};

// 便利函數
export const validate = {
    string: (value, constraints) => Validators.string(value, constraints),
    number: (value, constraints) => Validators.number(value, constraints),
    integer: (value, constraints) => Validators.integer(value, constraints),
    boolean: (value) => Validators.boolean(value),
    array: (value, constraints) => Validators.array(value, constraints),
    enum: (value, allowedValues) => Validators.enum(value, allowedValues),
    email: (value) => Validators.email(value),
    url: (value) => Validators.url(value),
    uuid: (value) => Validators.uuid(value),
    date: (value) => Validators.date(value),
    regex: (value, pattern, name) => Validators.regex(value, pattern, name)
};

export {
    Validators,
    ParameterValidator,
    CommandValidator,
    ValidationError,
    VALIDATION_TYPES
};