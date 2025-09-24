/**
 * 認證中間件 - 統一命令路由系統
 *
 * 功能：
 * - 驗證命令執行權限
 * - 管理用戶會話和角色
 * - 支援不同級別的安全策略
 * - 提供命令級別的存取控制
 */

// 權限級別
export const PERMISSION_LEVELS = {
    PUBLIC: 0,      // 公開命令，無需認證
    USER: 10,       // 需要用戶認證
    ADMIN: 50,      // 需要管理員權限
    SYSTEM: 100     // 系統級別命令，需要特殊權限
};

// 認證狀態
export const AUTH_STATUS = {
    AUTHENTICATED: 'authenticated',
    UNAUTHENTICATED: 'unauthenticated',
    EXPIRED: 'expired',
    INVALID: 'invalid'
};

// 認證錯誤
export class AuthenticationError extends Error {
    constructor(message, code, requiredLevel = null) {
        super(message);
        this.name = 'AuthenticationError';
        this.code = code;
        this.requiredLevel = requiredLevel;
    }
}

// 模擬用戶會話管理（在實際應用中應該使用真實的認證服務）
class SessionManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> sessionData
        this.users = new Map(); // userId -> userData

        // 初始化預設用戶
        this._initializeDefaultUsers();
    }

    // 初始化預設用戶（開發和測試用）
    _initializeDefaultUsers() {
        this.users.set('system', {
            id: 'system',
            username: 'system',
            role: 'system',
            permissions: PERMISSION_LEVELS.SYSTEM,
            created: Date.now()
        });

        this.users.set('admin', {
            id: 'admin',
            username: 'admin',
            role: 'admin',
            permissions: PERMISSION_LEVELS.ADMIN,
            created: Date.now()
        });

        this.users.set('user', {
            id: 'user',
            username: 'user',
            role: 'user',
            permissions: PERMISSION_LEVELS.USER,
            created: Date.now()
        });
    }

    // 創建會話
    createSession(userId, options = {}) {
        const user = this.users.get(userId);
        if (!user) {
            throw new AuthenticationError('用戶不存在', 'USER_NOT_FOUND');
        }

        const sessionId = this._generateSessionId();
        const sessionData = {
            id: sessionId,
            userId: user.id,
            user,
            created: Date.now(),
            lastAccess: Date.now(),
            expires: Date.now() + (options.ttl || 3600000), // 1小時預設
            metadata: options.metadata || {}
        };

        this.sessions.set(sessionId, sessionData);
        return sessionData;
    }

    // 驗證會話
    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return { valid: false, status: AUTH_STATUS.INVALID };
        }

        if (Date.now() > session.expires) {
            this.sessions.delete(sessionId);
            return { valid: false, status: AUTH_STATUS.EXPIRED };
        }

        // 更新最後存取時間
        session.lastAccess = Date.now();

        return {
            valid: true,
            status: AUTH_STATUS.AUTHENTICATED,
            session
        };
    }

    // 生成會話ID
    _generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    // 清理過期會話
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions) {
            if (now > session.expires) {
                this.sessions.delete(sessionId);
            }
        }
    }
}

// 全局會話管理器實例
const sessionManager = new SessionManager();

// 定期清理過期會話
setInterval(() => {
    sessionManager.cleanupExpiredSessions();
}, 60000); // 每分鐘清理一次

/**
 * 認證中間件工廠函數
 * @param {Object} options - 認證選項
 * @returns {Function} 中間件函數
 */
export function createAuthMiddleware(options = {}) {
    const {
        requiredLevel = PERMISSION_LEVELS.PUBLIC,
        allowAnonymous = true,
        enforceSessionValidation = true,
        customValidator = null
    } = options;

    return async function authMiddleware(data, middlewareOptions = {}) {
        const { context } = data;
        const executionContext = context.context || {};

        try {
            // 獲取認證信息
            const authInfo = extractAuthInfo(executionContext);

            // 如果不需要認證且允許匿名存取
            if (requiredLevel === PERMISSION_LEVELS.PUBLIC && allowAnonymous) {
                context.auth = {
                    status: AUTH_STATUS.UNAUTHENTICATED,
                    level: PERMISSION_LEVELS.PUBLIC,
                    anonymous: true
                };
                return;
            }

            // 驗證會話（如果提供了會話ID）
            if (authInfo.sessionId && enforceSessionValidation) {
                const validation = sessionManager.validateSession(authInfo.sessionId);

                if (!validation.valid) {
                    throw new AuthenticationError(
                        `會話驗證失敗: ${validation.status}`,
                        'SESSION_VALIDATION_FAILED'
                    );
                }

                context.auth = {
                    status: AUTH_STATUS.AUTHENTICATED,
                    level: validation.session.user.permissions,
                    user: validation.session.user,
                    session: validation.session
                };
            } else if (authInfo.apiKey) {
                // API金鑰認證（簡化實現）
                const userLevel = validateApiKey(authInfo.apiKey);
                context.auth = {
                    status: AUTH_STATUS.AUTHENTICATED,
                    level: userLevel,
                    apiKey: true
                };
            } else {
                // 無認證信息
                context.auth = {
                    status: AUTH_STATUS.UNAUTHENTICATED,
                    level: PERMISSION_LEVELS.PUBLIC
                };
            }

            // 檢查權限級別
            if (context.auth.level < requiredLevel) {
                throw new AuthenticationError(
                    `權限不足，需要級別 ${requiredLevel}，當前級別 ${context.auth.level}`,
                    'INSUFFICIENT_PERMISSIONS',
                    requiredLevel
                );
            }

            // 自定義驗證器
            if (customValidator) {
                const customResult = await customValidator(context.auth, data);
                if (!customResult.valid) {
                    throw new AuthenticationError(
                        customResult.message || '自定義認證驗證失敗',
                        customResult.code || 'CUSTOM_VALIDATION_FAILED'
                    );
                }
            }

            // 記錄認證成功
            console.log(`[Auth] 認證成功: ${context.auth.user?.username || 'Anonymous'} (級別: ${context.auth.level})`);

        } catch (error) {
            // 記錄認證失敗
            console.error(`[Auth] 認證失敗:`, error.message);

            // 更新執行上下文的錯誤狀態
            context.authError = error;

            throw error;
        }
    };
}

/**
 * 從執行上下文中提取認證信息
 * @param {Object} context - 執行上下文
 * @returns {Object} 認證信息
 */
function extractAuthInfo(context) {
    return {
        sessionId: context.sessionId || context.auth?.sessionId,
        apiKey: context.apiKey || context.auth?.apiKey,
        token: context.token || context.auth?.token,
        user: context.user || context.auth?.user
    };
}

/**
 * 驗證API金鑰（簡化實現）
 * @param {string} apiKey - API金鑰
 * @returns {number} 權限級別
 */
function validateApiKey(apiKey) {
    // 在實際應用中，這應該查詢數據庫或外部認證服務
    const apiKeys = {
        'system-key-12345': PERMISSION_LEVELS.SYSTEM,
        'admin-key-67890': PERMISSION_LEVELS.ADMIN,
        'user-key-abcdef': PERMISSION_LEVELS.USER
    };

    return apiKeys[apiKey] || PERMISSION_LEVELS.PUBLIC;
}

// 預定義的認證中間件
export const authMiddlewares = {
    // 公開存取（無需認證）
    public: createAuthMiddleware({
        requiredLevel: PERMISSION_LEVELS.PUBLIC,
        allowAnonymous: true
    }),

    // 需要用戶認證
    user: createAuthMiddleware({
        requiredLevel: PERMISSION_LEVELS.USER,
        allowAnonymous: false
    }),

    // 需要管理員權限
    admin: createAuthMiddleware({
        requiredLevel: PERMISSION_LEVELS.ADMIN,
        allowAnonymous: false
    }),

    // 需要系統級別權限
    system: createAuthMiddleware({
        requiredLevel: PERMISSION_LEVELS.SYSTEM,
        allowAnonymous: false
    })
};

// 便利函數

/**
 * 創建用戶會話
 * @param {string} userId - 用戶ID
 * @param {Object} options - 選項
 * @returns {Object} 會話數據
 */
export function createSession(userId, options) {
    return sessionManager.createSession(userId, options);
}

/**
 * 驗證會話
 * @param {string} sessionId - 會話ID
 * @returns {Object} 驗證結果
 */
export function validateSession(sessionId) {
    return sessionManager.validateSession(sessionId);
}

/**
 * 檢查命令權限
 * @param {Object} command - 命令對象
 * @param {Object} authContext - 認證上下文
 * @returns {boolean} 是否有權限
 */
export function hasPermission(command, authContext) {
    const requiredLevel = command.permissionLevel || PERMISSION_LEVELS.PUBLIC;
    const userLevel = authContext?.level || PERMISSION_LEVELS.PUBLIC;

    return userLevel >= requiredLevel;
}

/**
 * 獲取當前會話統計
 * @returns {Object} 會話統計
 */
export function getSessionStats() {
    return {
        activeSessions: sessionManager.sessions.size,
        totalUsers: sessionManager.users.size,
        sessionsByRole: Array.from(sessionManager.sessions.values()).reduce((acc, session) => {
            const role = session.user.role;
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {})
    };
}

export { sessionManager, SessionManager, PERMISSION_LEVELS, AUTH_STATUS, AuthenticationError };