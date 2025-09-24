/**
 * 用戶體驗驗證測試系統
 *
 * 功能：
 * - 用戶界面友好度測試
 * - 命令發現和幫助系統評估
 * - 錯誤訊息清晰度驗證
 * - 進度反饋和響應時間感知測試
 * - 整體用戶滿意度評估
 *
 * 用途：確保CCPM+SuperClaude整合的用戶體驗達到優秀水準
 * 配合：與test-epic-integration.js和performance-benchmarks.js協同評估系統品質
 */

import EventEmitter from 'eventemitter3';
import { performance } from 'perf_hooks';

// 用戶體驗測試類型定義
export const UX_TEST_TYPES = {
    USABILITY: 'usability',               // 可用性測試
    ACCESSIBILITY: 'accessibility',       // 可及性測試
    DISCOVERABILITY: 'discoverability',   // 可發現性測試
    FEEDBACK: 'feedback',                 // 反饋機制測試
    ERROR_HANDLING: 'error_handling',     // 錯誤處理測試
    PERFORMANCE_PERCEPTION: 'perf_perception', // 性能感知測試
    LEARNABILITY: 'learnability',         // 學習曲線測試
    EFFICIENCY: 'efficiency'              // 效率測試
};

// 用戶體驗評級定義
export const UX_RATINGS = {
    EXCELLENT: 'excellent',      // 優秀 (90-100分)
    GOOD: 'good',               // 良好 (80-89分)
    SATISFACTORY: 'satisfactory', // 滿意 (70-79分)
    FAIR: 'fair',               // 一般 (60-69分)
    POOR: 'poor',               // 差 (50-59分)
    UNACCEPTABLE: 'unacceptable' // 不可接受 (<50分)
};

// 用戶體驗標準定義
export const UX_STANDARDS = {
    COMMAND_DISCOVERY_TIME: 30,        // 30秒內發現命令
    HELP_RESPONSE_TIME: 5,            // 5秒內獲得幫助
    ERROR_COMPREHENSION_RATE: 0.9,     // 90%錯誤訊息理解率
    TASK_COMPLETION_RATE: 0.95,       // 95%任務完成率
    USER_SATISFACTION_SCORE: 4.0,     // 5分制滿意度>4.0
    LEARNING_CURVE_EFFICIENCY: 0.8,   // 80%學習效率
    PERCEIVED_RESPONSE_TIME: 2.0,     // 感知響應時間<2秒
    INTERFACE_INTUITIVENESS: 0.85     // 85%直觀性分數
};

/**
 * 模擬用戶行為類
 */
class SimulatedUser {
    constructor(profile = {}) {
        this.profile = {
            experience: 'intermediate',    // beginner, intermediate, expert
            patience: 'normal',           // low, normal, high
            techSavvy: 'moderate',       // low, moderate, high
            primaryTasks: ['analysis', 'configuration', 'monitoring'],
            ...profile
        };

        this.sessions = [];
        this.learningProgress = new Map();
        this.satisfactionHistory = [];
    }

    /**
     * 執行用戶任務
     */
    async executeTask(task, components) {
        const session = {
            taskId: task.id,
            taskName: task.name,
            startTime: performance.now(),
            steps: [],
            errors: [],
            completed: false,
            satisfaction: 0,
            efficiency: 0
        };

        try {
            for (const step of task.steps) {
                const stepStart = performance.now();
                const stepResult = await this._executeStep(step, components);
                const stepEnd = performance.now();

                session.steps.push({
                    name: step.name,
                    duration: stepEnd - stepStart,
                    result: stepResult,
                    success: stepResult.success,
                    difficulty: stepResult.difficulty
                });

                if (!stepResult.success) {
                    session.errors.push({
                        step: step.name,
                        error: stepResult.error,
                        recovered: stepResult.recovered,
                        recoveryTime: stepResult.recoveryTime
                    });

                    // 根據用戶耐心決定是否繼續
                    if (this.profile.patience === 'low' && session.errors.length > 2) {
                        throw new Error('用戶放棄任務 - 錯誤過多');
                    }
                }
            }

            session.completed = true;
            session.endTime = performance.now();
            session.totalDuration = session.endTime - session.startTime;

            // 計算滿意度
            session.satisfaction = this._calculateSatisfaction(session);
            session.efficiency = this._calculateEfficiency(session, task);

            this.sessions.push(session);
            this.satisfactionHistory.push(session.satisfaction);

            return session;

        } catch (error) {
            session.endTime = performance.now();
            session.totalDuration = session.endTime - session.startTime;
            session.abandonReason = error.message;

            this.sessions.push(session);
            throw error;
        }
    }

    /**
     * 執行單個步驟
     */
    async _executeStep(step, components) {
        const result = {
            success: false,
            difficulty: 1,
            error: null,
            recovered: false,
            recoveryTime: 0
        };

        try {
            // 根據用戶技術水平調整執行速度
            const thinkingTime = this._getThinkingTime(step.complexity);
            await new Promise(resolve => setTimeout(resolve, thinkingTime));

            // 執行命令
            const response = await components.commandRouter.route(step.command);
            result.success = true;
            result.response = response;

            // 評估步驟難度
            result.difficulty = this._assessStepDifficulty(step, response);

        } catch (error) {
            result.error = error;
            result.success = false;

            // 嘗試錯誤恢復
            const recoveryStart = performance.now();
            try {
                await this._attemptErrorRecovery(step, error, components);
                result.recovered = true;
                result.success = true;
            } catch (recoveryError) {
                result.recoveryError = recoveryError;
            }
            const recoveryEnd = performance.now();
            result.recoveryTime = recoveryEnd - recoveryStart;
        }

        return result;
    }

    /**
     * 計算用戶滿意度
     */
    _calculateSatisfaction(session) {
        let satisfaction = 5.0; // 基礎滿意度

        // 任務完成情況影響
        if (session.completed) {
            satisfaction += 1.0;
        } else {
            satisfaction -= 3.0;
        }

        // 執行效率影響
        if (session.totalDuration < 30000) { // 30秒以內
            satisfaction += 0.5;
        } else if (session.totalDuration > 120000) { // 超過2分鐘
            satisfaction -= 1.0;
        }

        // 錯誤數量影響
        const errorPenalty = session.errors.length * 0.5;
        satisfaction -= errorPenalty;

        // 錯誤恢復影響
        const recoveredErrors = session.errors.filter(e => e.recovered).length;
        satisfaction += recoveredErrors * 0.3;

        // 步驟難度影響
        const avgDifficulty = session.steps.reduce((sum, step) => sum + step.difficulty, 0) / session.steps.length;
        if (avgDifficulty > 3) {
            satisfaction -= (avgDifficulty - 3) * 0.2;
        }

        return Math.max(1, Math.min(5, satisfaction));
    }

    /**
     * 計算執行效率
     */
    _calculateEfficiency(session, task) {
        const expectedDuration = task.expectedDuration || 60000; // 預期1分鐘
        const actualDuration = session.totalDuration;

        const timeEfficiency = Math.max(0, 1 - (actualDuration - expectedDuration) / expectedDuration);
        const errorEfficiency = Math.max(0, 1 - session.errors.length * 0.1);
        const stepEfficiency = session.steps.filter(s => s.success).length / session.steps.length;

        return (timeEfficiency + errorEfficiency + stepEfficiency) / 3;
    }

    /**
     * 獲取思考時間
     */
    _getThinkingTime(complexity) {
        const baseTime = {
            beginner: 5000,
            intermediate: 2000,
            expert: 500
        }[this.profile.experience];

        return baseTime * complexity;
    }

    /**
     * 評估步驟難度
     */
    _assessStepDifficulty(step, response) {
        let difficulty = step.baseDifficulty || 1;

        // 根據響應時間調整
        if (response && response.duration > 5000) {
            difficulty += 0.5; // 響應慢增加難度感知
        }

        // 根據響應內容調整
        if (response && response.data && typeof response.data === 'object') {
            const complexity = JSON.stringify(response.data).length;
            if (complexity > 1000) {
                difficulty += 0.3; // 複雜響應增加難度
            }
        }

        return Math.min(5, difficulty);
    }

    /**
     * 嘗試錯誤恢復
     */
    async _attemptErrorRecovery(step, error, components) {
        // 根據錯誤類型和用戶經驗嘗試不同恢復策略

        if (error.code === 'COMMAND_NOT_FOUND') {
            // 嘗試幫助命令
            return await components.commandRouter.route('/integrated:help');
        }

        if (error.code === 'INVALID_PARAMETER') {
            // 嘗試獲取命令說明
            return await components.commandRouter.route(`/integrated:help ${step.command.split(' ')[0]}`);
        }

        if (error.code === 'TIMEOUT') {
            // 重試一次
            return await components.commandRouter.route(step.command);
        }

        throw new Error(`無法恢復錯誤: ${error.message}`);
    }
}

/**
 * 用戶體驗驗證測試執行器
 */
export class UXValidationRunner extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            userProfiles: ['beginner', 'intermediate', 'expert'],
            testDuration: 300000,        // 5分鐘測試時長
            minUserSessions: 10,         // 最少用戶會話數
            satisfactionThreshold: 4.0,  // 滿意度閾值
            completionRateThreshold: 0.9, // 完成率閾值
            enableRecording: true,       // 啟用會話記錄
            detailedAnalysis: true,      // 詳細分析
            ...options
        };

        // 測試結果
        this.results = new Map();
        this.userSessions = [];
        this.simulatedUsers = [];

        // 測試任務定義
        this.testTasks = this._defineTestTasks();

        // 初始化模擬用戶
        this._initializeSimulatedUsers();
    }

    /**
     * 執行完整用戶體驗驗證測試
     */
    async runFullUXValidation(components) {
        const startTime = performance.now();

        try {
            this.emit('uxValidationStarted');

            // 執行各種UX測試
            const testResults = new Map();

            // 1. 可用性測試
            testResults.set('usability', await this._runUsabilityTests(components));

            // 2. 命令發現性測試
            testResults.set('discoverability', await this._runDiscoverabilityTests(components));

            // 3. 錯誤處理測試
            testResults.set('errorHandling', await this._runErrorHandlingTests(components));

            // 4. 性能感知測試
            testResults.set('performancePerception', await this._runPerformancePerceptionTests(components));

            // 5. 學習曲線測試
            testResults.set('learnability', await this._runLearnabilityTests(components));

            // 6. 反饋機制測試
            testResults.set('feedback', await this._runFeedbackTests(components));

            // 7. 界面直觀性測試
            testResults.set('intuitiveness', await this._runIntuitivenesssTests(components));

            const endTime = performance.now();
            const totalDuration = endTime - startTime;

            // 生成UX驗證報告
            const uxReport = await this._generateUXReport(testResults, totalDuration);

            this.emit('uxValidationCompleted', uxReport);
            return uxReport;

        } catch (error) {
            this.emit('uxValidationFailed', error);
            throw error;
        }
    }

    /**
     * 執行可用性測試
     */
    async _runUsabilityTests(components) {
        const results = {
            taskCompletionRate: 0,
            averageSatisfaction: 0,
            averageEfficiency: 0,
            userSessions: [],
            issues: []
        };

        for (const user of this.simulatedUsers) {
            for (const task of this.testTasks.slice(0, 3)) { // 前3個基本任務
                try {
                    const session = await user.executeTask(task, components);
                    results.userSessions.push(session);

                    if (session.completed) {
                        results.taskCompletionRate++;
                    }

                    results.averageSatisfaction += session.satisfaction;
                    results.averageEfficiency += session.efficiency;

                    // 識別可用性問題
                    if (session.errors.length > 0) {
                        results.issues.push({
                            taskName: task.name,
                            userProfile: user.profile.experience,
                            errors: session.errors,
                            severity: this._assessIssueSeverity(session.errors)
                        });
                    }

                } catch (error) {
                    results.userSessions.push({
                        taskName: task.name,
                        userProfile: user.profile.experience,
                        abandoned: true,
                        reason: error.message
                    });
                }
            }
        }

        const totalSessions = results.userSessions.length;
        results.taskCompletionRate = results.taskCompletionRate / totalSessions;
        results.averageSatisfaction = results.averageSatisfaction / totalSessions;
        results.averageEfficiency = results.averageEfficiency / totalSessions;

        // UX評級計算
        results.rating = this._calculateUXRating({
            completionRate: results.taskCompletionRate,
            satisfaction: results.averageSatisfaction,
            efficiency: results.averageEfficiency,
            issueCount: results.issues.length
        });

        return results;
    }

    /**
     * 執行命令發現性測試
     */
    async _runDiscoverabilityTests(components) {
        const results = {
            helpSystemUsage: 0,
            commandDiscoveryTime: [],
            searchSuccess: 0,
            navigationEfficiency: 0
        };

        // 測試幫助系統
        for (const user of this.simulatedUsers.slice(0, 5)) { // 5個用戶樣本
            const startTime = performance.now();

            try {
                // 嘗試發現特定命令
                const discoveryTasks = [
                    { command: '/integrated:status', hint: '查看系統狀態' },
                    { command: '/integrated:analyze', hint: '執行分析' },
                    { command: '/sc:help', hint: '獲取幫助' }
                ];

                for (const task of discoveryTasks) {
                    const taskStart = performance.now();

                    // 首先嘗試幫助系統
                    await components.commandRouter.route('/integrated:help');
                    results.helpSystemUsage++;

                    // 嘗試執行命令
                    try {
                        await components.commandRouter.route(task.command);
                        const taskEnd = performance.now();
                        results.commandDiscoveryTime.push(taskEnd - taskStart);
                        results.searchSuccess++;
                    } catch (error) {
                        // 發現失敗
                    }
                }

            } catch (error) {
                // 發現過程中的錯誤
            }
        }

        // 計算發現性指標
        const avgDiscoveryTime = results.commandDiscoveryTime.reduce((a, b) => a + b, 0) /
                                 results.commandDiscoveryTime.length;

        results.averageDiscoveryTime = avgDiscoveryTime;
        results.discoverySuccessRate = results.searchSuccess / (this.simulatedUsers.length * 3);

        results.rating = this._calculateDiscoverabilityRating(results);

        return results;
    }

    /**
     * 執行錯誤處理測試
     */
    async _runErrorHandlingTests(components) {
        const results = {
            errorScenarios: [],
            comprehensionRate: 0,
            recoveryRate: 0,
            errorMessages: []
        };

        // 故意觸發各種錯誤
        const errorScenarios = [
            { command: '/nonexistent:command', type: 'COMMAND_NOT_FOUND' },
            { command: '/integrated:analyze invalid-param', type: 'INVALID_PARAMETER' },
            { command: '/integrated:status --wrong-flag', type: 'INVALID_FLAG' }
        ];

        for (const scenario of errorScenarios) {
            const scenarioResult = {
                scenario: scenario.command,
                expectedType: scenario.type,
                actualError: null,
                comprehensible: false,
                recoverable: false,
                userRecovered: []
            };

            try {
                await components.commandRouter.route(scenario.command);
            } catch (error) {
                scenarioResult.actualError = error;

                // 評估錯誤訊息的可理解性
                scenarioResult.comprehensible = this._assessErrorComprehensibility(error);

                // 測試用戶是否能夠恢復
                for (const user of this.simulatedUsers.slice(0, 3)) {
                    try {
                        await user._attemptErrorRecovery(
                            { command: scenario.command },
                            error,
                            components
                        );
                        scenarioResult.userRecovered.push(user.profile.experience);
                        scenarioResult.recoverable = true;
                    } catch (recoveryError) {
                        // 恢復失敗
                    }
                }
            }

            results.errorScenarios.push(scenarioResult);
            results.errorMessages.push({
                original: scenario.command,
                error: scenarioResult.actualError?.message || 'No error',
                comprehensible: scenarioResult.comprehensible
            });
        }

        // 計算指標
        const comprehensibleErrors = results.errorScenarios.filter(s => s.comprehensible).length;
        const recoverableErrors = results.errorScenarios.filter(s => s.recoverable).length;

        results.comprehensionRate = comprehensibleErrors / results.errorScenarios.length;
        results.recoveryRate = recoverableErrors / results.errorScenarios.length;

        results.rating = this._calculateErrorHandlingRating(results);

        return results;
    }

    /**
     * 生成UX驗證報告
     */
    async _generateUXReport(testResults, duration) {
        const report = {
            timestamp: new Date().toISOString(),
            duration: Math.round(duration),
            epic: 'CCPM+SuperClaude整合 - 用戶體驗驗證',
            version: '1.0.0',

            // 整體UX評估
            overallUXRating: await this._calculateOverallUXRating(testResults),

            // 標準達成情況
            standardsCompliance: await this._assessStandardsCompliance(testResults),

            // 詳細測試結果
            detailedResults: Array.from(testResults.entries()).map(([testType, result]) => ({
                testType,
                ...result
            })),

            // 用戶滿意度分析
            userSatisfactionAnalysis: await this._analyzeUserSatisfaction(),

            // UX問題識別
            uxIssues: await this._identifyUXIssues(testResults),

            // 改進建議
            improvementRecommendations: await this._generateUXRecommendations(testResults),

            // 用戶反饋模擬
            simulatedUserFeedback: await this._generateUserFeedback()
        };

        return report;
    }

    /**
     * 計算整體UX評級
     */
    async _calculateOverallUXRating(testResults) {
        const weights = {
            usability: 0.3,
            discoverability: 0.2,
            errorHandling: 0.2,
            performancePerception: 0.15,
            learnability: 0.1,
            feedback: 0.05
        };

        let weightedScore = 0;
        let totalWeight = 0;

        for (const [testType, result] of testResults) {
            if (weights[testType] && result.rating) {
                const numericRating = this._convertRatingToNumeric(result.rating);
                weightedScore += numericRating * weights[testType];
                totalWeight += weights[testType];
            }
        }

        const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
        const overallRating = this._convertNumericToRating(overallScore);

        return {
            numericScore: Math.round(overallScore * 100) / 100,
            rating: overallRating,
            targetAchieved: overallScore >= 80, // 80分以上為達標
            summary: `用戶體驗整體評級為 ${overallRating}，數值評分 ${Math.round(overallScore)} 分`
        };
    }

    /**
     * 定義測試任務
     */
    _defineTestTasks() {
        return [
            {
                id: 'basic_status',
                name: '查看系統狀態',
                description: '用戶想要了解系統當前狀態',
                expectedDuration: 30000,
                steps: [
                    { name: '執行狀態查詢', command: '/integrated:status', baseDifficulty: 1, complexity: 1 }
                ]
            },
            {
                id: 'help_discovery',
                name: '獲取幫助資訊',
                description: '新用戶需要了解系統功能',
                expectedDuration: 60000,
                steps: [
                    { name: '查看幫助', command: '/integrated:help', baseDifficulty: 1, complexity: 1 },
                    { name: '查看特定命令幫助', command: '/integrated:help status', baseDifficulty: 2, complexity: 1 }
                ]
            },
            {
                id: 'analysis_task',
                name: '執行分析任務',
                description: '用戶需要執行系統分析',
                expectedDuration: 90000,
                steps: [
                    { name: '啟動分析', command: '/integrated:analyze basic', baseDifficulty: 2, complexity: 2 },
                    { name: '查看分析結果', command: '/integrated:status', baseDifficulty: 1, complexity: 1 }
                ]
            }
        ];
    }

    /**
     * 初始化模擬用戶
     */
    _initializeSimulatedUsers() {
        const profiles = [
            { experience: 'beginner', patience: 'low', techSavvy: 'low' },
            { experience: 'beginner', patience: 'normal', techSavvy: 'low' },
            { experience: 'intermediate', patience: 'normal', techSavvy: 'moderate' },
            { experience: 'intermediate', patience: 'high', techSavvy: 'moderate' },
            { experience: 'expert', patience: 'low', techSavvy: 'high' },
            { experience: 'expert', patience: 'normal', techSavvy: 'high' }
        ];

        this.simulatedUsers = profiles.map(profile => new SimulatedUser(profile));
    }

    /**
     * 計算UX評級
     */
    _calculateUXRating(metrics) {
        const score = (
            metrics.completionRate * 40 +
            (metrics.satisfaction / 5) * 30 +
            metrics.efficiency * 20 +
            Math.max(0, 10 - metrics.issueCount)
        );

        return this._convertNumericToRating(score);
    }

    /**
     * 數值評級轉換
     */
    _convertNumericToRating(score) {
        if (score >= 90) return UX_RATINGS.EXCELLENT;
        if (score >= 80) return UX_RATINGS.GOOD;
        if (score >= 70) return UX_RATINGS.SATISFACTORY;
        if (score >= 60) return UX_RATINGS.FAIR;
        if (score >= 50) return UX_RATINGS.POOR;
        return UX_RATINGS.UNACCEPTABLE;
    }

    /**
     * 評級轉數值
     */
    _convertRatingToNumeric(rating) {
        const ratingMap = {
            [UX_RATINGS.EXCELLENT]: 95,
            [UX_RATINGS.GOOD]: 85,
            [UX_RATINGS.SATISFACTORY]: 75,
            [UX_RATINGS.FAIR]: 65,
            [UX_RATINGS.POOR]: 55,
            [UX_RATINGS.UNACCEPTABLE]: 25
        };

        return ratingMap[rating] || 50;
    }
}

// 導出便利函數
export const runUXValidation = async (components, options = {}) => {
    const runner = new UXValidationRunner(options);
    return await runner.runFullUXValidation(components);
};

export default UXValidationRunner;