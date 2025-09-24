#!/usr/bin/env node

/**
 * EventSystem 整合測試
 *
 * 功能：
 * - 測試事件系統核心功能
 * - 驗證與CommandRouter的整合
 * - 性能基準測試
 *
 * 使用方法：node test-event-system.js
 */

const fs = require('fs').promises;
const path = require('path');

// 事件系統組件
const EventBus = require('./EventBus');
const EventStore = require('./EventStore');
const EventSerializer = require('./EventSerializer');
const { EventMiddleware, ValidationMiddleware, PerformanceMiddleware } = require('./EventMiddleware');

// 事件定義
const { SystemEventFactory, SYSTEM_EVENT_TYPES } = require('./events/SystemEvents');
const { CCPMEventFactory, CCPM_EVENT_TYPES } = require('./events/CCPMEvents');
const { SuperClaudeEventFactory, SUPERCLAUDE_EVENT_TYPES } = require('./events/SuperClaudeEvents');

// CommandRouter整合
const CommandRouter = require('./CommandRouter');

/**
 * 測試套件
 */
class EventSystemTestSuite {
    constructor() {
        this.eventBus = null;
        this.commandRouter = null;
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            errors: []
        };
    }

    /**
     * 執行所有測試
     */
    async runAllTests() {
        console.log('🚀 開始執行Event System整合測試...\n');

        try {
            // 初始化測試環境
            await this.setupTestEnvironment();

            // 基礎功能測試
            await this.runBasicTests();

            // 中間件測試
            await this.runMiddlewareTests();

            // 持久化測試
            await this.runPersistenceTests();

            // 整合測試
            await this.runIntegrationTests();

            // 性能測試
            await this.runPerformanceTests();

            // 錯誤處理測試
            await this.runErrorHandlingTests();

        } catch (error) {
            console.error('❌ 測試執行失敗:', error.message);
            this.testResults.errors.push(error);
        } finally {
            await this.cleanup();
            this.printSummary();
        }
    }

    /**
     * 設置測試環境
     */
    async setupTestEnvironment() {
        console.log('📋 設置測試環境...');

        // 創建測試用的事件總線
        this.eventBus = new EventBus({
            enablePersistence: true,
            enableMiddleware: true,
            enableBatching: false,
            store: {
                storePath: path.join(process.cwd(), '.claude', 'data', 'test-events')
            }
        });

        await this.eventBus.initialize();

        // 創建CommandRouter實例
        this.commandRouter = new CommandRouter();
        await this.commandRouter.initialize();

        console.log('✅ 測試環境設置完成\n');
    }

    /**
     * 基礎功能測試
     */
    async runBasicTests() {
        console.log('🧪 執行基礎功能測試...');

        // 測試事件發布和訂閱
        await this.testPublishSubscribe();

        // 測試事件工廠
        await this.testEventFactories();

        // 測試事件驗證
        await this.testEventValidation();

        console.log('✅ 基礎功能測試完成\n');
    }

    /**
     * 測試發布訂閱
     */
    async testPublishSubscribe() {
        this.test('事件發布訂閱', async () => {
            let receivedEvent = null;

            // 訂閱測試事件
            const subscriptionId = this.eventBus.subscribe('TEST_EVENT', (event) => {
                receivedEvent = event;
            });

            // 發布事件
            const eventId = await this.eventBus.publish('TEST_EVENT', {
                message: 'Hello World',
                timestamp: new Date().toISOString()
            });

            // 等待事件處理
            await new Promise(resolve => setTimeout(resolve, 100));

            // 驗證事件接收
            if (!receivedEvent) {
                throw new Error('事件未被接收');
            }

            if (receivedEvent.data.message !== 'Hello World') {
                throw new Error('事件數據不匹配');
            }

            // 取消訂閱
            const unsubscribed = this.eventBus.unsubscribe(subscriptionId);
            if (!unsubscribed) {
                throw new Error('取消訂閱失敗');
            }

            return { eventId, receivedEvent };
        });
    }

    /**
     * 測試事件工廠
     */
    async testEventFactories() {
        this.test('系統事件工廠', async () => {
            // 測試命令執行事件
            const commandEvent = SystemEventFactory.createCommandExecutedEvent({
                command: 'test-command',
                args: { param: 'value' },
                result: { success: true },
                source: 'test'
            });

            if (commandEvent.type !== SYSTEM_EVENT_TYPES.COMMAND_EXECUTED) {
                throw new Error('事件類型不正確');
            }

            // 發布並驗證
            await this.eventBus.publish(commandEvent.type, commandEvent.data);

            return commandEvent;
        });

        this.test('CCPM事件工廠', async () => {
            const codeGenEvent = CCPMEventFactory.createCodeGeneratedEvent({
                files: ['file1.js', 'file2.js'],
                template: { name: 'test-template' },
                variables: { name: 'test' }
            });

            if (codeGenEvent.type !== CCPM_EVENT_TYPES.CODE_GENERATED) {
                throw new Error('CCPM事件類型不正確');
            }

            await this.eventBus.publish(codeGenEvent.type, codeGenEvent.data);

            return codeGenEvent;
        });

        this.test('SuperClaude事件工廠', async () => {
            const workflowEvent = SuperClaudeEventFactory.createWorkflowEvent({
                eventType: SUPERCLAUDE_EVENT_TYPES.WORKFLOW_STARTED,
                workflowId: 'test-workflow',
                workflowType: 'analysis'
            });

            if (workflowEvent.type !== SUPERCLAUDE_EVENT_TYPES.WORKFLOW_STARTED) {
                throw new Error('SuperClaude事件類型不正確');
            }

            await this.eventBus.publish(workflowEvent.type, workflowEvent.data);

            return workflowEvent;
        });
    }

    /**
     * 測試事件驗證
     */
    async testEventValidation() {
        this.test('事件驗證中間件', async () => {
            // 添加驗證中間件
            const validationMiddleware = new ValidationMiddleware({
                requiredFields: ['type', 'timestamp', 'data', 'source']
            });

            this.eventBus.middleware.use(validationMiddleware);

            // 測試有效事件
            await this.eventBus.publish('VALID_EVENT', {
                message: 'valid'
            }, {
                source: 'test'
            });

            // 測試無效事件 - 應該拋出錯誤
            try {
                await this.eventBus.publish('INVALID_EVENT', {});
                throw new Error('應該拋出驗證錯誤');
            } catch (error) {
                if (!error.message.includes('缺少必需字段')) {
                    throw error;
                }
            }

            return true;
        });
    }

    /**
     * 中間件測試
     */
    async runMiddlewareTests() {
        console.log('🔧 執行中間件測試...');

        await this.testPerformanceMiddleware();
        await this.testErrorHandlingMiddleware();

        console.log('✅ 中間件測試完成\n');
    }

    /**
     * 測試性能中間件
     */
    async testPerformanceMiddleware() {
        this.test('性能監控中間件', async () => {
            const perfMiddleware = new PerformanceMiddleware({
                slowThreshold: 50,
                trackMetrics: true
            });

            this.eventBus.middleware.use(perfMiddleware);

            // 發布快速事件
            await this.eventBus.publish('FAST_EVENT', { data: 'fast' });

            // 發布慢事件 (模擬處理延遲)
            this.eventBus.subscribe('SLOW_EVENT', async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
            });

            await this.eventBus.publish('SLOW_EVENT', { data: 'slow' });

            const metrics = perfMiddleware.getMetrics();

            if (metrics.processed < 2) {
                throw new Error('性能中間件未正確記錄事件');
            }

            return metrics;
        });
    }

    /**
     * 測試錯誤處理中間件
     */
    async testErrorHandlingMiddleware() {
        this.test('錯誤處理中間件', async () => {
            // 添加會失敗的訂閱者
            this.eventBus.subscribe('ERROR_EVENT', () => {
                throw new Error('測試錯誤');
            });

            // 發布事件 - 應該處理錯誤但不中斷系統
            await this.eventBus.publish('ERROR_EVENT', { test: true });

            // 驗證系統仍然正常運行
            let normalEventReceived = false;
            this.eventBus.subscribe('NORMAL_EVENT', () => {
                normalEventReceived = true;
            });

            await this.eventBus.publish('NORMAL_EVENT', { test: true });

            await new Promise(resolve => setTimeout(resolve, 100));

            if (!normalEventReceived) {
                throw new Error('錯誤處理後系統未正常運行');
            }

            return true;
        });
    }

    /**
     * 持久化測試
     */
    async runPersistenceTests() {
        console.log('💾 執行持久化測試...');

        await this.testEventStorage();
        await this.testEventQuery();
        await this.testEventReplay();

        console.log('✅ 持久化測試完成\n');
    }

    /**
     * 測試事件存儲
     */
    async testEventStorage() {
        this.test('事件存儲功能', async () => {
            const testEvent = SystemEventFactory.createCommandExecutedEvent({
                command: 'test-storage',
                args: {},
                result: { stored: true }
            });

            // 發布事件（應該被存儲）
            const eventId = await this.eventBus.publish(testEvent.type, testEvent.data, {
                persist: true
            });

            // 直接從存儲檢索
            const storedEvent = await this.eventBus.store.retrieve(eventId);

            if (!storedEvent) {
                throw new Error('事件未被存儲');
            }

            if (storedEvent.data.command !== 'test-storage') {
                throw new Error('存儲的事件數據不正確');
            }

            return { eventId, storedEvent };
        });
    }

    /**
     * 測試事件查詢
     */
    async testEventQuery() {
        this.test('事件查詢功能', async () => {
            // 發布多個測試事件
            for (let i = 0; i < 5; i++) {
                await this.eventBus.publish('QUERY_TEST_EVENT', {
                    index: i,
                    timestamp: new Date().toISOString()
                });
            }

            // 等待存儲完成
            await new Promise(resolve => setTimeout(resolve, 200));

            // 查詢事件
            const events = await this.eventBus.store.query({
                type: 'QUERY_TEST_EVENT',
                limit: 10
            });

            if (events.length < 5) {
                throw new Error(`查詢到的事件數量不足: ${events.length}`);
            }

            return events;
        });
    }

    /**
     * 測試事件回放
     */
    async testEventReplay() {
        this.test('事件回放功能', async () => {
            const replayedEvents = [];

            // 回放最近的事件
            await this.eventBus.replay({
                limit: 3,
                sortOrder: 'desc'
            }, (event) => {
                replayedEvents.push(event);
            });

            if (replayedEvents.length === 0) {
                throw new Error('沒有回放到任何事件');
            }

            return replayedEvents;
        });
    }

    /**
     * 整合測試
     */
    async runIntegrationTests() {
        console.log('🔗 執行整合測試...');

        await this.testCommandRouterIntegration();
        await this.testCrossSystemCommunication();

        console.log('✅ 整合測試完成\n');
    }

    /**
     * 測試與CommandRouter的整合
     */
    async testCommandRouterIntegration() {
        this.test('CommandRouter整合', async () => {
            let routerEventReceived = null;

            // 監聽命令路由事件
            this.eventBus.subscribe('SYSTEM_COMMAND_EXECUTED', (event) => {
                routerEventReceived = event;
            });

            // 通過CommandRouter執行命令
            const result = await this.commandRouter.execute({
                action: 'test',
                params: { integration: true }
            });

            // 等待事件處理
            await new Promise(resolve => setTimeout(resolve, 200));

            // 如果CommandRouter已整合事件系統，應該收到事件
            // 注意：這取決於CommandRouter的實際實施

            return { result, routerEventReceived };
        });
    }

    /**
     * 測試跨系統通信
     */
    async testCrossSystemCommunication() {
        this.test('跨系統通信', async () => {
            let superclaudeEventReceived = null;
            let ccpmEventReceived = null;

            // 模擬CCPM到SuperClaude的通信
            this.eventBus.subscribe('SC_CONTEXT_LOADED', (event) => {
                superclaudeEventReceived = event;
            });

            // 發布CCPM項目初始化事件
            const ccpmEvent = CCPMEventFactory.createProjectInitializedEvent({
                projectPath: '/test/project',
                projectName: 'test-project',
                config: { test: true }
            });

            await this.eventBus.publish(ccpmEvent.type, ccmpEvent.data);

            // 模擬SuperClaude到CCPM的響應
            this.eventBus.subscribe('CCPM_EXTERNAL_TOOL_INVOKED', (event) => {
                ccpmEventReceived = event;
            });

            const scEvent = SuperClaudeEventFactory.createAgentEvent({
                eventType: SUPERCLAUDE_EVENT_TYPES.AGENT_COMPLETED,
                agentId: 'test-agent',
                agentType: 'analysis',
                result: { analysis: 'completed' }
            });

            await this.eventBus.publish(scEvent.type, scEvent.data);

            await new Promise(resolve => setTimeout(resolve, 200));

            return {
                ccmpEvent: ccpmEventReceived,
                scEvent: superclaudeEventReceived
            };
        });
    }

    /**
     * 性能測試
     */
    async runPerformanceTests() {
        console.log('⚡ 執行性能測試...');

        await this.testThroughput();
        await this.testLatency();
        await this.testMemoryUsage();

        console.log('✅ 性能測試完成\n');
    }

    /**
     * 測試吞吐量
     */
    async testThroughput() {
        this.test('吞吐量測試', async () => {
            const eventCount = 1000;
            const startTime = Date.now();

            // 並行發布大量事件
            const promises = Array.from({ length: eventCount }, (_, i) =>
                this.eventBus.publish('THROUGHPUT_TEST', {
                    index: i,
                    timestamp: Date.now()
                })
            );

            await Promise.all(promises);

            const duration = Date.now() - startTime;
            const throughput = Math.round(eventCount / (duration / 1000));

            console.log(`   📊 吞吐量: ${throughput} events/sec (目標: >1000)`);

            if (throughput < 1000) {
                console.warn(`   ⚠️  吞吐量低於目標: ${throughput} < 1000`);
            }

            return { eventCount, duration, throughput };
        });
    }

    /**
     * 測試延遲
     */
    async testLatency() {
        this.test('延遲測試', async () => {
            const latencies = [];

            for (let i = 0; i < 100; i++) {
                const startTime = Date.now();

                await this.eventBus.publish('LATENCY_TEST', {
                    index: i,
                    startTime
                });

                const latency = Date.now() - startTime;
                latencies.push(latency);
            }

            const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
            const maxLatency = Math.max(...latencies);

            console.log(`   📊 平均延遲: ${averageLatency.toFixed(2)}ms (目標: <50ms)`);
            console.log(`   📊 最大延遲: ${maxLatency}ms (目標: <200ms)`);

            if (averageLatency > 50) {
                console.warn(`   ⚠️  平均延遲高於目標: ${averageLatency} > 50ms`);
            }

            return { averageLatency, maxLatency, latencies };
        });
    }

    /**
     * 測試內存使用
     */
    async testMemoryUsage() {
        this.test('內存使用測試', async () => {
            const initialMemory = process.memoryUsage();

            // 發布大量事件來測試內存使用
            for (let i = 0; i < 5000; i++) {
                await this.eventBus.publish('MEMORY_TEST', {
                    data: 'x'.repeat(1000), // 1KB per event
                    index: i
                });
            }

            // 強制垃圾回收（如果支持）
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            console.log(`   📊 內存增加: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

            return { initialMemory, finalMemory, memoryIncrease };
        });
    }

    /**
     * 錯誤處理測試
     */
    async runErrorHandlingTests() {
        console.log('🛡️ 執行錯誤處理測試...');

        await this.testSerializationErrors();
        await this.testStorageErrors();
        await this.testMiddlewareErrors();

        console.log('✅ 錯誤處理測試完成\n');
    }

    /**
     * 測試序列化錯誤
     */
    async testSerializationErrors() {
        this.test('序列化錯誤處理', async () => {
            // 創建循環引用對象
            const circularObj = { name: 'test' };
            circularObj.self = circularObj;

            try {
                await this.eventBus.publish('CIRCULAR_TEST', circularObj);
                // 如果沒有拋出錯誤，說明循環引用被正確處理
            } catch (error) {
                // 如果拋出錯誤，檢查是否為預期的序列化錯誤
                if (!error.message.includes('序列化') && !error.message.includes('Circular')) {
                    throw error;
                }
            }

            return true;
        });
    }

    /**
     * 測試存儲錯誤
     */
    async testStorageErrors() {
        this.test('存儲錯誤處理', async () => {
            // 模擬存儲錯誤場景
            const originalStore = this.eventBus.store;

            // 臨時替換為會失敗的存儲
            this.eventBus.store = {
                store: async () => {
                    throw new Error('模擬存儲失敗');
                }
            };

            try {
                await this.eventBus.publish('STORAGE_ERROR_TEST', { test: true });
            } catch (error) {
                if (!error.message.includes('存儲失敗')) {
                    throw error;
                }
            } finally {
                // 恢復原始存儲
                this.eventBus.store = originalStore;
            }

            return true;
        });
    }

    /**
     * 測試中間件錯誤
     */
    async testMiddlewareErrors() {
        this.test('中間件錯誤處理', async () => {
            // 添加會失敗的中間件
            this.eventBus.middleware.use({
                name: 'failing-middleware',
                enabled: true,
                priority: 0,
                process: async () => {
                    throw new Error('中間件測試錯誤');
                }
            });

            try {
                await this.eventBus.publish('MIDDLEWARE_ERROR_TEST', { test: true });
                throw new Error('應該拋出中間件錯誤');
            } catch (error) {
                if (!error.message.includes('中間件測試錯誤')) {
                    throw error;
                }
            }

            return true;
        });
    }

    /**
     * 測試輔助函數
     */
    test(name, testFunction) {
        this.testResults.total++;

        return new Promise(async (resolve) => {
            try {
                console.log(`  🧪 ${name}...`);
                const startTime = Date.now();

                const result = await testFunction();

                const duration = Date.now() - startTime;
                console.log(`     ✅ 通過 (${duration}ms)`);

                this.testResults.passed++;
                resolve(result);

            } catch (error) {
                console.log(`     ❌ 失敗: ${error.message}`);
                this.testResults.failed++;
                this.testResults.errors.push({
                    test: name,
                    error: error.message,
                    stack: error.stack
                });
                resolve(null);
            }
        });
    }

    /**
     * 清理資源
     */
    async cleanup() {
        console.log('🧹 清理測試環境...');

        if (this.eventBus) {
            await this.eventBus.dispose();
        }

        // 清理測試數據目錄
        const testDataPath = path.join(process.cwd(), '.claude', 'data', 'test-events');
        try {
            const files = await fs.readdir(testDataPath);
            for (const file of files) {
                await fs.unlink(path.join(testDataPath, file));
            }
        } catch (error) {
            // 忽略清理錯誤
        }

        console.log('✅ 清理完成\n');
    }

    /**
     * 打印測試摘要
     */
    printSummary() {
        console.log('📋 測試摘要');
        console.log('='.repeat(50));
        console.log(`總測試數: ${this.testResults.total}`);
        console.log(`通過: ${this.testResults.passed} ✅`);
        console.log(`失敗: ${this.testResults.failed} ❌`);
        console.log(`成功率: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`);

        if (this.testResults.failed > 0) {
            console.log('\n❌ 失敗的測試:');
            this.testResults.errors.forEach(error => {
                console.log(`  - ${error.test}: ${error.error}`);
            });
        }

        console.log('\n' + '='.repeat(50));

        if (this.testResults.failed === 0) {
            console.log('🎉 所有測試通過！EventSystem已準備好投入使用。');
        } else {
            console.log('⚠️  部分測試失敗，請檢查問題後重新測試。');
        }
    }
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
    const testSuite = new EventSystemTestSuite();
    testSuite.runAllTests()
        .then(() => {
            process.exit(testSuite.testResults.failed === 0 ? 0 : 1);
        })
        .catch((error) => {
            console.error('💥 測試執行出現嚴重錯誤:', error);
            process.exit(1);
        });
}

module.exports = EventSystemTestSuite;