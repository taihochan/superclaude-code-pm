#!/usr/bin/env node

/**
 * Task 72 - 整合測試和優化執行腳本
 *
 * 功能：
 * - 執行完整的Epic驗收測試
 * - 驗證20%性能提升目標
 * - 確保100%端到端測試通過率
 * - 驗證用戶體驗優秀級別
 * - 生成Epic完成報告
 *
 * 使用方法：
 * node run-task72-validation.js [options]
 */

import { performance } from 'perf_hooks';
import { writeFile } from 'fs/promises';
import path from 'path';
import FullValidationExecutor from './execute-full-validation.js';

// 命令行參數解析
const args = process.argv.slice(2);
const options = {
    enableParallelTests: !args.includes('--no-parallel'),
    enableStressTests: !args.includes('--no-stress'),
    enableStabilityTests: !args.includes('--no-stability'),
    generateDetailedReport: !args.includes('--brief'),
    verbose: args.includes('--verbose'),
    outputDir: args.find(arg => arg.startsWith('--output='))?.replace('--output=', '') || './.claude/framework/reports'
};

console.log('🚀 Task 72 - CCPM+SuperClaude整合Epic驗收開始');
console.log('=' .repeat(80));

async function main() {
    const globalStart = performance.now();

    try {
        // 創建輸出目錄
        await ensureOutputDirectory(options.outputDir);

        // 初始化驗證執行器
        console.log('📋 初始化Epic驗證執行器...');
        const executor = new FullValidationExecutor({
            enableParallelTests: options.enableParallelTests,
            enableStressTests: options.enableStressTests,
            enableStabilityTests: options.enableStabilityTests,
            generateDetailedReport: options.generateDetailedReport,

            // 嚴格的質量門檻
            minimumPassRate: 1.0,              // 100%測試通過率
            minimumPerformanceImprovement: 20, // 20%性能提升
            minimumUXRating: 85,              // 85分用戶體驗評級

            totalTimeout: 1800000,            // 30分鐘總超時
            phaseTimeout: 600000              // 10分鐘階段超時
        });

        // 設置事件監聽
        setupEventListeners(executor, options.verbose);

        // 執行完整驗證
        console.log('🔬 開始執行Epic完整驗證...');
        const validationReport = await executor.executeFullValidation();

        const globalEnd = performance.now();
        const totalDuration = Math.round(globalEnd - globalStart);

        // 顯示驗證結果
        displayValidationResults(validationReport, totalDuration);

        // 保存詳細報告
        await saveReports(validationReport, options.outputDir);

        // 評估Epic完成狀態
        const epicCompletionStatus = assessEpicCompletion(validationReport);
        displayEpicCompletionStatus(epicCompletionStatus);

        // 生成性能改進報告
        await generatePerformanceImprovementReport(validationReport, options.outputDir);

        // 檢查是否達到所有目標
        const allTargetsAchieved = checkAllTargetsAchieved(validationReport);

        if (allTargetsAchieved) {
            console.log('🎉 Epic驗收完成 - 所有目標已達成！');
            console.log('✅ CCPM+SuperClaude整合已達到生產就緒狀態');
            process.exit(0);
        } else {
            console.log('⚠️  Epic驗收完成 - 部分目標未達成');
            console.log('📋 請檢查報告中的改進建議');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Epic驗收執行失敗：', error.message);

        if (options.verbose) {
            console.error('詳細錯誤信息：', error.stack);
        }

        // 保存錯誤報告
        await saveErrorReport(error, options.outputDir);

        process.exit(1);
    }
}

/**
 * 確保輸出目錄存在
 */
async function ensureOutputDirectory(outputDir) {
    try {
        const { mkdir } = await import('fs/promises');
        await mkdir(outputDir, { recursive: true });
        console.log(`📁 輸出目錄準備完成: ${outputDir}`);
    } catch (error) {
        console.warn(`⚠️  無法創建輸出目錄: ${error.message}`);
    }
}

/**
 * 設置事件監聽器
 */
function setupEventListeners(executor, verbose) {
    executor.on('validationStarted', () => {
        console.log('🚦 Epic驗證流程啟動');
    });

    executor.on('phaseStarted', (phase) => {
        console.log(`📍 階段開始: ${getPhaseDisplayName(phase)}`);
    });

    executor.on('phaseCompleted', (phase, result) => {
        const duration = Math.round(result.duration);
        console.log(`✅ 階段完成: ${getPhaseDisplayName(phase)} (${duration}ms)`);

        if (verbose) {
            console.log(`   狀態: ${result.status}`);
        }
    });

    executor.on('phaseFailed', (phase, result) => {
        const duration = Math.round(result.duration);
        console.log(`❌ 階段失敗: ${getPhaseDisplayName(phase)} (${duration}ms)`);
        console.log(`   錯誤: ${result.error.message}`);
    });

    executor.on('validationCompleted', () => {
        console.log('🏁 Epic驗證流程完成');
    });

    executor.on('validationFailed', (error) => {
        console.log('💥 Epic驗證流程失敗:', error.message);
    });

    // 詳細進度事件
    if (verbose) {
        executor.on('integrationTestsStarted', () => {
            console.log('   🧪 啟動整合測試...');
        });

        executor.on('performanceBenchmarksStarted', () => {
            console.log('   ⚡ 啟動性能基準測試...');
        });

        executor.on('uxValidationStarted', () => {
            console.log('   👤 啟動用戶體驗驗證...');
        });

        executor.on('stressTestsStarted', () => {
            console.log('   💪 啟動壓力測試...');
        });
    }
}

/**
 * 獲取階段顯示名稱
 */
function getPhaseDisplayName(phase) {
    const phaseNames = {
        initialization: '初始化',
        integration_tests: '整合測試',
        performance_benchmarks: '性能基準測試',
        ux_validation: '用戶體驗驗證',
        stress_testing: '壓力測試',
        stability_testing: '穩定性測試',
        report_generation: '報告生成'
    };

    return phaseNames[phase] || phase;
}

/**
 * 顯示驗證結果
 */
function displayValidationResults(report, totalDuration) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 Epic驗證結果摘要');
    console.log('='.repeat(80));

    console.log(`⏱️  總執行時間: ${Math.round(totalDuration / 1000)}秒`);
    console.log(`📋 執行階段: ${report.executionSummary.completedPhases}/${report.executionSummary.totalPhases}`);
    console.log(`🎯 整體狀態: ${report.metadata.status === 'completed' ? '✅ 完成' : '❌ 失敗'}`);

    console.log('\n📈 關鍵質量指標:');
    console.log(`   測試通過率: ${Math.round(report.qualityMetrics.overallPassRate * 100)}%`);
    console.log(`   性能提升: ${Math.round(report.qualityMetrics.performanceImprovement)}%`);
    console.log(`   用戶體驗評級: ${Math.round(report.qualityMetrics.uxRating)}分`);
    console.log(`   系統穩定性: ${Math.round(report.qualityMetrics.systemStability)}%`);
    console.log(`   質量等級: ${getQualityLevelDisplayName(report.qualityMetrics.qualityLevel)}`);
}

/**
 * 獲取質量等級顯示名稱
 */
function getQualityLevelDisplayName(level) {
    const levelNames = {
        production_ready: '🟢 生產就緒',
        near_production: '🟡 接近生產',
        development_ready: '🔵 開發就緒',
        needs_improvement: '🟠 需要改進',
        not_ready: '🔴 未就緒'
    };

    return levelNames[level] || level;
}

/**
 * 顯示Epic完成狀態
 */
function displayEpicCompletionStatus(status) {
    console.log('\n' + '='.repeat(80));
    console.log('🏆 Epic完成狀態評估');
    console.log('='.repeat(80));

    console.log(`整體完成度: ${status.overallCompletion}%`);

    console.log('\n📋 任務完成情況:');
    for (const [taskName, taskStatus] of Object.entries(status.taskCompletions)) {
        const icon = taskStatus >= 90 ? '✅' : taskStatus >= 70 ? '🟡' : '❌';
        console.log(`   ${icon} ${taskName}: ${taskStatus}%`);
    }

    if (status.recommendations && status.recommendations.length > 0) {
        console.log('\n💡 改進建議:');
        status.recommendations.slice(0, 5).forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });
    }
}

/**
 * 評估Epic完成狀態
 */
function assessEpicCompletion(report) {
    const taskCompletions = {
        'Task 63-65: 基礎架構': assessFoundationCompletion(report),
        'Task 66-67: 並行執行': assessParallelExecutionCompletion(report),
        'Task 68-69: 核心功能': assessCoreFunctionalityCompletion(report),
        'Task 70-71: 整合優化': assessIntegrationOptimizationCompletion(report),
        'Task 72: 整合測試': assessIntegrationTestingCompletion(report)
    };

    const overallCompletion = Math.round(
        Object.values(taskCompletions).reduce((sum, completion) => sum + completion, 0) /
        Object.values(taskCompletions).length
    );

    const recommendations = generateCompletionRecommendations(taskCompletions, report);

    return {
        overallCompletion,
        taskCompletions,
        recommendations,
        epicStatus: overallCompletion >= 90 ? 'completed' : overallCompletion >= 70 ? 'near_completion' : 'in_progress'
    };
}

/**
 * 評估各任務完成度
 */
function assessFoundationCompletion(report) {
    // 基於整合測試結果評估基礎架構完成度
    const integrationResult = report.phaseResults.find(p => p.phase === 'integration_tests');
    if (integrationResult && integrationResult.result) {
        return Math.min(100, Math.round(integrationResult.result.passRate * 100));
    }
    return 0;
}

function assessParallelExecutionCompletion(report) {
    // 基於性能測試結果評估並行執行完成度
    const performanceResult = report.phaseResults.find(p => p.phase === 'performance_benchmarks');
    if (performanceResult && performanceResult.result) {
        const improvement = performanceResult.result.overallImprovement;
        return Math.min(100, Math.max(0, Math.round((improvement / 20) * 100)));
    }
    return 0;
}

function assessCoreFunctionalityCompletion(report) {
    // 基於UX和整合測試評估核心功能完成度
    const uxResult = report.phaseResults.find(p => p.phase === 'ux_validation');
    const integrationResult = report.phaseResults.find(p => p.phase === 'integration_tests');

    let score = 0;
    if (uxResult && uxResult.result) {
        score += (uxResult.result.uxScore / 100) * 50;
    }
    if (integrationResult && integrationResult.result) {
        score += integrationResult.result.passRate * 50;
    }

    return Math.round(score);
}

function assessIntegrationOptimizationCompletion(report) {
    // 基於所有測試結果評估整合優化完成度
    const stabilityResult = report.phaseResults.find(p => p.phase === 'stability_testing');
    const performanceResult = report.phaseResults.find(p => p.phase === 'performance_benchmarks');

    let score = 0;
    if (stabilityResult && stabilityResult.result && stabilityResult.result.overallPassed) {
        score += 50;
    }
    if (performanceResult && performanceResult.result && performanceResult.result.meetsPerformanceTarget) {
        score += 50;
    }

    return score;
}

function assessIntegrationTestingCompletion(report) {
    // Task 72本身的完成度評估
    const completedPhases = report.executionSummary.completedPhases;
    const totalPhases = report.executionSummary.totalPhases;
    const overallSuccess = report.executionSummary.overallSuccess;

    const phaseCompletion = (completedPhases / totalPhases) * 80;
    const successBonus = overallSuccess ? 20 : 0;

    return Math.round(phaseCompletion + successBonus);
}

/**
 * 檢查是否達成所有目標
 */
function checkAllTargetsAchieved(report) {
    const requirements = {
        testPassRate: report.qualityMetrics.overallPassRate >= 1.0,        // 100%測試通過
        performanceImprovement: report.qualityMetrics.performanceImprovement >= 20, // 20%性能提升
        uxRating: report.qualityMetrics.uxRating >= 85,                   // 85分用戶體驗
        qualityLevel: ['production_ready', 'near_production'].includes(report.qualityMetrics.qualityLevel)
    };

    const achievedTargets = Object.values(requirements).filter(Boolean).length;
    const totalTargets = Object.keys(requirements).length;

    console.log('\n🎯 目標達成情況:');
    console.log(`   ✅ 端到端測試通過率: ${requirements.testPassRate ? '達成' : '未達成'} (${Math.round(report.qualityMetrics.overallPassRate * 100)}%)`);
    console.log(`   ✅ 性能提升目標: ${requirements.performanceImprovement ? '達成' : '未達成'} (${Math.round(report.qualityMetrics.performanceImprovement)}%)`);
    console.log(`   ✅ 用戶體驗目標: ${requirements.uxRating ? '達成' : '未達成'} (${Math.round(report.qualityMetrics.uxRating)}分)`);
    console.log(`   ✅ 生產就緒狀態: ${requirements.qualityLevel ? '達成' : '未達成'} (${getQualityLevelDisplayName(report.qualityMetrics.qualityLevel)})`);

    console.log(`\n📊 總達成率: ${achievedTargets}/${totalTargets} (${Math.round(achievedTargets / totalTargets * 100)}%)`);

    return achievedTargets === totalTargets;
}

/**
 * 保存報告
 */
async function saveReports(report, outputDir) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // 保存完整報告
        const fullReportPath = path.join(outputDir, `task72-full-report-${timestamp}.json`);
        await writeFile(fullReportPath, JSON.stringify(report, null, 2));
        console.log(`📄 完整報告已保存: ${fullReportPath}`);

        // 保存摘要報告
        const summaryReport = {
            timestamp: report.metadata.timestamp,
            executionSummary: report.executionSummary,
            qualityMetrics: report.qualityMetrics,
            qualityGates: report.qualityGates,
            recommendations: report.recommendations?.slice(0, 10) // 前10個建議
        };

        const summaryReportPath = path.join(outputDir, `task72-summary-${timestamp}.json`);
        await writeFile(summaryReportPath, JSON.stringify(summaryReport, null, 2));
        console.log(`📋 摘要報告已保存: ${summaryReportPath}`);

    } catch (error) {
        console.warn(`⚠️  保存報告失敗: ${error.message}`);
    }
}

/**
 * 生成性能改進報告
 */
async function generatePerformanceImprovementReport(report, outputDir) {
    const performanceResult = report.phaseResults.find(p => p.phase === 'performance_benchmarks');

    if (!performanceResult || !performanceResult.result) return;

    const improvementReport = {
        timestamp: new Date().toISOString(),
        title: 'CCPM+SuperClaude整合性能改進報告',
        overallImprovement: performanceResult.result.overallImprovement,
        targetAchievement: performanceResult.result.meetsPerformanceTarget,
        benchmarkDetails: performanceResult.result.benchmarkResults || [],
        recommendations: performanceResult.result.optimizationRecommendations || []
    };

    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const perfReportPath = path.join(outputDir, `performance-improvement-${timestamp}.json`);
        await writeFile(perfReportPath, JSON.stringify(improvementReport, null, 2));
        console.log(`⚡ 性能改進報告已保存: ${perfReportPath}`);
    } catch (error) {
        console.warn(`⚠️  保存性能報告失敗: ${error.message}`);
    }
}

/**
 * 保存錯誤報告
 */
async function saveErrorReport(error, outputDir) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const errorReport = {
            timestamp,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            process: {
                version: process.version,
                platform: process.platform,
                memoryUsage: process.memoryUsage()
            }
        };

        const errorReportPath = path.join(outputDir, `error-report-${timestamp}.json`);
        await writeFile(errorReportPath, JSON.stringify(errorReport, null, 2));
        console.log(`💥 錯誤報告已保存: ${errorReportPath}`);
    } catch (saveError) {
        console.warn(`⚠️  保存錯誤報告失敗: ${saveError.message}`);
    }
}

/**
 * 生成完成建議
 */
function generateCompletionRecommendations(taskCompletions, report) {
    const recommendations = [];

    for (const [taskName, completion] of Object.entries(taskCompletions)) {
        if (completion < 90) {
            recommendations.push(`提升 ${taskName} 完成度至90%以上`);
        }
    }

    if (report.qualityMetrics.overallPassRate < 1.0) {
        recommendations.push('解決所有測試失敗問題，達到100%通過率');
    }

    if (report.qualityMetrics.performanceImprovement < 20) {
        recommendations.push('優化系統性能，達到20%以上提升目標');
    }

    if (report.qualityMetrics.uxRating < 85) {
        recommendations.push('改進用戶體驗，提升評級至85分以上');
    }

    return recommendations;
}

// 執行主函數
main().catch(error => {
    console.error('致命錯誤:', error);
    process.exit(1);
});