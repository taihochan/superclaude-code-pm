/**
 * ReportGenerator - 智能報告生成器
 *
 * 功能：
 * - 生成多格式綜合分析報告（JSON、Markdown、HTML）
 * - 整合洞察分析和可視化數據
 * - 支持自定義報告模板和樣式
 * - 提供互動式報告和靜態文檔輸出
 *
 * 頁面：報告輸出層 / 決策支援文檔
 * 邏輯：基於整合數據和洞察生成結構化報告，支持多種輸出格式
 * 需求：高質量報告生成、多格式支持、可視化整合
 * 用途：ResultIntegrator的最終輸出組件
 * 配合：接收所有處理結果，生成統一的決策支援報告
 */

import { EventEmitter } from 'events';
import fs from 'fs'.promises;
import path from 'path';

// 報告格式類型
const REPORT_FORMATS = {
    JSON: 'json',
    MARKDOWN: 'markdown',
    HTML: 'html',
    PDF: 'pdf',
    XML: 'xml'
};

// 報告類型
const REPORT_TYPES = {
    COMPREHENSIVE: 'comprehensive',  // 綜合報告
    EXECUTIVE: 'executive',         // 執行摘要
    TECHNICAL: 'technical',         // 技術詳細
    DASHBOARD: 'dashboard',         // 儀表板
    NOTIFICATION: 'notification'    // 通知報告
};

// 可視化圖表類型
const CHART_TYPES = {
    LINE: 'line',
    BAR: 'bar',
    PIE: 'pie',
    SCATTER: 'scatter',
    HEATMAP: 'heatmap',
    TIMELINE: 'timeline'
};

/**
 * 報告模板管理器
 */
class ReportTemplateManager {
    constructor() {
        this.templates = new Map();
        this._initializeDefaultTemplates();
    }

    /**
     * 註冊報告模板
     */
    registerTemplate(name, template) {
        this.templates.set(name, template);
    }

    /**
     * 獲取報告模板
     */
    getTemplate(name) {
        return this.templates.get(name);
    }

    /**
     * 初始化默認模板
     * @private
     */
    _initializeDefaultTemplates() {
        // 綜合報告模板
        this.registerTemplate('comprehensive', {
            name: 'comprehensive',
            format: REPORT_FORMATS.MARKDOWN,
            sections: [
                'header',
                'executive_summary',
                'key_insights',
                'data_analysis',
                'trends_patterns',
                'anomalies',
                'recommendations',
                'technical_details',
                'appendix'
            ],
            includeVisualizations: true,
            includeRawData: false
        });

        // 執行摘要模板
        this.registerTemplate('executive', {
            name: 'executive',
            format: REPORT_FORMATS.HTML,
            sections: [
                'header',
                'executive_summary',
                'key_metrics',
                'critical_insights',
                'action_items'
            ],
            includeVisualizations: true,
            includeRawData: false,
            maxLength: 5000
        });

        // 技術詳細模板
        this.registerTemplate('technical', {
            name: 'technical',
            format: REPORT_FORMATS.JSON,
            sections: [
                'metadata',
                'processing_details',
                'raw_data',
                'analysis_results',
                'quality_metrics',
                'system_info'
            ],
            includeVisualizations: false,
            includeRawData: true
        });

        // 儀表板模板
        this.registerTemplate('dashboard', {
            name: 'dashboard',
            format: REPORT_FORMATS.HTML,
            sections: [
                'metrics_overview',
                'status_indicators',
                'trend_charts',
                'alert_summary'
            ],
            includeVisualizations: true,
            includeRawData: false,
            interactive: true
        });
    }
}

/**
 * 可視化生成器
 */
class VisualizationGenerator {
    constructor(options = {}) {
        this.options = {
            defaultChartSize: { width: 800, height: 400 },
            colorScheme: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'],
            enableInteractive: options.enableInteractive !== false,
            ...options
        };
    }

    /**
     * 生成圖表配置
     */
    generateChart(data, type, options = {}) {
        const chartConfig = {
            type,
            data: this._processChartData(data, type),
            options: {
                ...this.options.defaultChartSize,
                ...options,
                responsive: true,
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title
                    },
                    legend: {
                        display: type !== CHART_TYPES.PIE
                    }
                }
            },
            colors: this.options.colorScheme
        };

        return chartConfig;
    }

    /**
     * 生成趨勢圖表
     */
    generateTrendChart(trendData) {
        const chartData = trendData.map((trend, index) => ({
            x: index,
            y: trend.confidence,
            label: trend.group || `Trend ${index + 1}`
        }));

        return this.generateChart(chartData, CHART_TYPES.LINE, {
            title: '趨勢分析',
            yAxis: { title: '信心度' },
            xAxis: { title: '時間序列' }
        });
    }

    /**
     * 生成洞察分佈圖表
     */
    generateInsightDistribution(insights) {
        const distribution = {};
        insights.forEach(insight => {
            const type = insight.type;
            distribution[type] = (distribution[type] || 0) + 1;
        });

        const chartData = Object.entries(distribution).map(([type, count]) => ({
            label: type,
            value: count
        }));

        return this.generateChart(chartData, CHART_TYPES.PIE, {
            title: '洞察類型分佈'
        });
    }

    /**
     * 生成優先級熱力圖
     */
    generatePriorityHeatmap(insights) {
        const priorityData = {};
        const typeData = {};

        insights.forEach(insight => {
            const priority = insight.priority.label;
            const type = insight.type;

            if (!priorityData[priority]) {
                priorityData[priority] = {};
            }
            if (!priorityData[priority][type]) {
                priorityData[priority][type] = 0;
            }
            priorityData[priority][type]++;
        });

        return this.generateChart(priorityData, CHART_TYPES.HEATMAP, {
            title: '洞察優先級熱力圖',
            xAxis: { title: '洞察類型' },
            yAxis: { title: '優先級' }
        });
    }

    /**
     * 生成時間線圖表
     */
    generateTimeline(events) {
        const timelineData = events
            .filter(event => event.timestamp)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .map(event => ({
                time: new Date(event.timestamp).toISOString(),
                label: event.title || event.description,
                value: event.confidence || 1,
                category: event.type || 'default'
            }));

        return this.generateChart(timelineData, CHART_TYPES.TIMELINE, {
            title: '事件時間線',
            xAxis: { title: '時間' },
            yAxis: { title: '重要性' }
        });
    }

    /**
     * 處理圖表數據
     * @private
     */
    _processChartData(data, type) {
        switch (type) {
            case CHART_TYPES.LINE:
            case CHART_TYPES.SCATTER:
                return this._processXYData(data);
            case CHART_TYPES.BAR:
                return this._processBarData(data);
            case CHART_TYPES.PIE:
                return this._processPieData(data);
            case CHART_TYPES.HEATMAP:
                return this._processHeatmapData(data);
            case CHART_TYPES.TIMELINE:
                return this._processTimelineData(data);
            default:
                return data;
        }
    }

    _processXYData(data) {
        if (Array.isArray(data)) {
            return {
                datasets: [{
                    label: 'Data Series',
                    data: data.map((item, index) => ({
                        x: item.x || index,
                        y: item.y || item.value || item
                    }))
                }]
            };
        }
        return data;
    }

    _processBarData(data) {
        if (Array.isArray(data)) {
            return {
                labels: data.map(item => item.label || item.name),
                datasets: [{
                    label: 'Values',
                    data: data.map(item => item.value || item.count || item),
                    backgroundColor: this.options.colorScheme
                }]
            };
        }
        return data;
    }

    _processPieData(data) {
        if (Array.isArray(data)) {
            return {
                labels: data.map(item => item.label || item.name),
                datasets: [{
                    data: data.map(item => item.value || item.count || item),
                    backgroundColor: this.options.colorScheme
                }]
            };
        }
        return data;
    }

    _processHeatmapData(data) {
        // 簡化的熱力圖數據處理
        return data;
    }

    _processTimelineData(data) {
        if (Array.isArray(data)) {
            return {
                datasets: [{
                    label: 'Timeline Events',
                    data: data.map(item => ({
                        x: new Date(item.time),
                        y: item.value || 1,
                        label: item.label
                    }))
                }]
            };
        }
        return data;
    }
}

/**
 * 格式化器基類
 */
class ReportFormatter {
    constructor(format) {
        this.format = format;
    }

    async format(reportData, template) {
        throw new Error('Subclass must implement format method');
    }
}

/**
 * JSON格式化器
 */
class JSONFormatter extends ReportFormatter {
    constructor() {
        super(REPORT_FORMATS.JSON);
    }

    async format(reportData, template) {
        const jsonReport = {
            metadata: {
                title: reportData.title,
                generatedAt: new Date().toISOString(),
                format: this.format,
                template: template.name
            },
            ...reportData
        };

        return JSON.stringify(jsonReport, null, 2);
    }
}

/**
 * Markdown格式化器
 */
class MarkdownFormatter extends ReportFormatter {
    constructor() {
        super(REPORT_FORMATS.MARKDOWN);
    }

    async format(reportData, template) {
        let markdown = '';

        // 標題
        if (reportData.title) {
            markdown += `# ${reportData.title}\n\n`;
        }

        // 元數據
        if (reportData.metadata) {
            markdown += `**生成時間**: ${new Date(reportData.metadata.generatedAt).toLocaleString('zh-TW')}\n`;
            markdown += `**處理時間**: ${reportData.metadata.processingTime}ms\n`;
            markdown += `**數據來源**: ${reportData.metadata.inputCount} 個結果\n\n`;
        }

        // 執行摘要
        if (reportData.executiveSummary && template.sections.includes('executive_summary')) {
            markdown += `## 執行摘要\n\n`;
            markdown += `${reportData.executiveSummary.summary}\n\n`;

            if (reportData.executiveSummary.keyPoints) {
                markdown += `### 關鍵要點\n\n`;
                reportData.executiveSummary.keyPoints.forEach(point => {
                    markdown += `- ${point}\n`;
                });
                markdown += `\n`;
            }
        }

        // 關鍵洞察
        if (reportData.insights && template.sections.includes('key_insights')) {
            markdown += `## 關鍵洞察\n\n`;

            const highPriorityInsights = reportData.insights.filter(insight =>
                insight.priority.level >= 3
            );

            highPriorityInsights.forEach(insight => {
                markdown += `### ${insight.priority.label} 優先級：${insight.title}\n\n`;
                markdown += `**信心度**: ${(insight.confidence * 100).toFixed(1)}%\n\n`;
                markdown += `${insight.description}\n\n`;

                if (insight.recommendations && insight.recommendations.length > 0) {
                    markdown += `**建議行動**:\n`;
                    insight.recommendations.forEach(rec => {
                        markdown += `- ${rec}\n`;
                    });
                    markdown += `\n`;
                }
            });
        }

        // 趨勢分析
        if (reportData.trends && template.sections.includes('trends_patterns')) {
            markdown += `## 趨勢與模式\n\n`;

            if (reportData.trends.shortTerm && reportData.trends.shortTerm.length > 0) {
                markdown += `### 短期趨勢\n\n`;
                reportData.trends.shortTerm.forEach(trend => {
                    markdown += `- **${trend.group}**: ${this._getTrendLabel(trend.direction)} (信心度: ${(trend.confidence * 100).toFixed(1)}%)\n`;
                });
                markdown += `\n`;
            }

            if (reportData.trends.longTerm && reportData.trends.longTerm.length > 0) {
                markdown += `### 長期趨勢\n\n`;
                reportData.trends.longTerm.forEach(trend => {
                    markdown += `- **${trend.group}**: ${this._getTrendLabel(trend.direction)} (信心度: ${(trend.confidence * 100).toFixed(1)}%)\n`;
                });
                markdown += `\n`;
            }
        }

        // 異常檢測
        if (reportData.anomalies && template.sections.includes('anomalies')) {
            markdown += `## 異常檢測\n\n`;

            if (reportData.anomalies.length > 0) {
                reportData.anomalies.forEach(anomaly => {
                    markdown += `### ${anomaly.severity.label} 異常：${anomaly.type}\n\n`;
                    markdown += `${anomaly.explanation}\n\n`;

                    if (anomaly.recommendations) {
                        markdown += `**建議措施**:\n`;
                        anomaly.recommendations.forEach(rec => {
                            markdown += `- ${rec}\n`;
                        });
                        markdown += `\n`;
                    }
                });
            } else {
                markdown += `未檢測到異常情況。\n\n`;
            }
        }

        // 建議行動
        if (reportData.recommendations && template.sections.includes('recommendations')) {
            markdown += `## 建議行動\n\n`;

            const actionItems = reportData.insights
                .filter(insight => insight.actionItems && insight.actionItems.length > 0)
                .flatMap(insight => insight.actionItems);

            if (actionItems.length > 0) {
                markdown += `### 待辦事項\n\n`;
                actionItems.forEach(action => {
                    markdown += `- [ ] **${action.title}** (優先級: ${action.priority})\n`;
                    markdown += `  - 截止日期: ${new Date(action.dueDate).toLocaleDateString('zh-TW')}\n`;
                    markdown += `  - 負責人: ${action.assignee}\n`;
                    if (action.description) {
                        markdown += `  - 描述: ${action.description}\n`;
                    }
                    markdown += `\n`;
                });
            }
        }

        // 技術細節
        if (reportData.technicalDetails && template.sections.includes('technical_details')) {
            markdown += `## 技術細節\n\n`;

            if (reportData.technicalDetails.processing) {
                markdown += `### 處理統計\n\n`;
                const stats = reportData.technicalDetails.processing;
                markdown += `- 總處理時間: ${stats.totalTime}ms\n`;
                markdown += `- 數據融合時間: ${stats.fusionTime}ms\n`;
                markdown += `- 洞察生成時間: ${stats.insightTime}ms\n`;
                markdown += `- 報告生成時間: ${stats.reportTime}ms\n\n`;
            }

            if (reportData.technicalDetails.quality) {
                markdown += `### 品質指標\n\n`;
                const quality = reportData.technicalDetails.quality;
                markdown += `- 整體品質分數: ${(quality.overall * 100).toFixed(1)}%\n`;
                markdown += `- 數據準確性: ${(quality.accuracy * 100).toFixed(1)}%\n`;
                markdown += `- 數據完整性: ${(quality.completeness * 100).toFixed(1)}%\n`;
                markdown += `- 數據一致性: ${(quality.consistency * 100).toFixed(1)}%\n\n`;
            }
        }

        return markdown;
    }

    _getTrendLabel(direction) {
        const labels = {
            'upward': '上升',
            'downward': '下降',
            'stable': '穩定',
            'volatile': '波動',
            'cyclical': '週期性'
        };
        return labels[direction] || direction;
    }
}

/**
 * HTML格式化器
 */
class HTMLFormatter extends ReportFormatter {
    constructor() {
        super(REPORT_FORMATS.HTML);
    }

    async format(reportData, template) {
        const css = this._generateCSS();
        const bodyHTML = await this._generateBodyHTML(reportData, template);

        return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportData.title || '整合分析報告'}</title>
    <style>${css}</style>
    ${template.interactive ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' : ''}
</head>
<body>
    ${bodyHTML}
    ${template.interactive ? this._generateScripts(reportData) : ''}
</body>
</html>`;
    }

    _generateCSS() {
        return `
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .report-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 10px;
                margin-bottom: 30px;
                text-align: center;
            }
            .report-header h1 {
                margin: 0;
                font-size: 2.5rem;
                font-weight: 300;
            }
            .report-header .meta {
                margin-top: 10px;
                opacity: 0.9;
            }
            .section {
                background: white;
                margin-bottom: 20px;
                padding: 25px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .section h2 {
                color: #2c3e50;
                border-bottom: 2px solid #3498db;
                padding-bottom: 10px;
                margin-top: 0;
            }
            .insight-card {
                border-left: 4px solid;
                padding: 15px;
                margin: 15px 0;
                border-radius: 4px;
            }
            .priority-high { border-left-color: #e74c3c; background-color: #fdf2f2; }
            .priority-medium { border-left-color: #f39c12; background-color: #fef9e7; }
            .priority-low { border-left-color: #2ecc71; background-color: #f0f9f0; }
            .priority-critical { border-left-color: #8e44ad; background-color: #f8f4f9; }
            .confidence-bar {
                width: 100%;
                height: 8px;
                background-color: #ecf0f1;
                border-radius: 4px;
                overflow: hidden;
                margin: 10px 0;
            }
            .confidence-fill {
                height: 100%;
                background: linear-gradient(90deg, #e74c3c 0%, #f39c12 50%, #2ecc71 100%);
                transition: width 0.3s ease;
            }
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 20px 0;
            }
            .metric-card {
                text-align: center;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #dee2e6;
            }
            .metric-value {
                font-size: 2rem;
                font-weight: bold;
                color: #2c3e50;
            }
            .metric-label {
                color: #6c757d;
                margin-top: 5px;
            }
            .chart-container {
                margin: 20px 0;
                height: 400px;
            }
            .action-items {
                list-style: none;
                padding: 0;
            }
            .action-item {
                background: #f8f9fa;
                padding: 15px;
                margin: 10px 0;
                border-radius: 6px;
                border-left: 3px solid #3498db;
            }
            .action-item h4 {
                margin: 0 0 5px 0;
                color: #2c3e50;
            }
            .action-meta {
                font-size: 0.9rem;
                color: #6c757d;
            }
            @media (max-width: 768px) {
                body { padding: 10px; }
                .metrics-grid { grid-template-columns: 1fr; }
                .report-header h1 { font-size: 2rem; }
            }
        `;
    }

    async _generateBodyHTML(reportData, template) {
        let html = '';

        // 報告標題
        html += `
            <div class="report-header">
                <h1>${reportData.title || '整合分析報告'}</h1>
                <div class="meta">
                    生成時間: ${new Date().toLocaleString('zh-TW')}
                    ${reportData.metadata ? ` | 處理時間: ${reportData.metadata.processingTime}ms` : ''}
                </div>
            </div>
        `;

        // 關鍵指標
        if (template.sections.includes('key_metrics') || template.sections.includes('metrics_overview')) {
            html += await this._generateMetricsSection(reportData);
        }

        // 執行摘要
        if (reportData.executiveSummary && template.sections.includes('executive_summary')) {
            html += `
                <div class="section">
                    <h2>執行摘要</h2>
                    <p>${reportData.executiveSummary.summary}</p>
                    ${reportData.executiveSummary.keyPoints ?
                        '<ul>' + reportData.executiveSummary.keyPoints.map(point => `<li>${point}</li>`).join('') + '</ul>'
                        : ''}
                </div>
            `;
        }

        // 關鍵洞察
        if (reportData.insights && template.sections.includes('key_insights')) {
            html += await this._generateInsightsSection(reportData.insights);
        }

        // 圖表區域
        if (template.includeVisualizations && reportData.visualizations) {
            html += await this._generateVisualizationsSection(reportData.visualizations);
        }

        // 行動項目
        if (template.sections.includes('action_items')) {
            html += await this._generateActionItemsSection(reportData);
        }

        return html;
    }

    async _generateMetricsSection(reportData) {
        const metrics = [];

        if (reportData.insights) {
            metrics.push({
                label: '總洞察數',
                value: reportData.insights.length,
                unit: '個'
            });

            const highPriorityCount = reportData.insights.filter(i => i.priority.level >= 3).length;
            metrics.push({
                label: '高優先級洞察',
                value: highPriorityCount,
                unit: '個'
            });

            const avgConfidence = reportData.insights.reduce((sum, i) => sum + i.confidence, 0) / reportData.insights.length;
            metrics.push({
                label: '平均信心度',
                value: (avgConfidence * 100).toFixed(1),
                unit: '%'
            });
        }

        if (reportData.metadata) {
            metrics.push({
                label: '處理時間',
                value: reportData.metadata.processingTime,
                unit: 'ms'
            });
        }

        return `
            <div class="section">
                <h2>關鍵指標</h2>
                <div class="metrics-grid">
                    ${metrics.map(metric => `
                        <div class="metric-card">
                            <div class="metric-value">${metric.value}<small>${metric.unit}</small></div>
                            <div class="metric-label">${metric.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async _generateInsightsSection(insights) {
        const sortedInsights = insights
            .sort((a, b) => b.priority.level - a.priority.level)
            .slice(0, 10); // 限制顯示前10個

        return `
            <div class="section">
                <h2>關鍵洞察</h2>
                ${sortedInsights.map(insight => `
                    <div class="insight-card priority-${insight.priority.label.toLowerCase()}">
                        <h3>${insight.title}</h3>
                        <p>${insight.description}</p>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${insight.confidence * 100}%"></div>
                        </div>
                        <small>信心度: ${(insight.confidence * 100).toFixed(1)}% | 優先級: ${insight.priority.label}</small>
                        ${insight.recommendations && insight.recommendations.length > 0 ?
                            '<div style="margin-top: 10px;"><strong>建議:</strong><ul>' +
                            insight.recommendations.map(rec => `<li>${rec}</li>`).join('') +
                            '</ul></div>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    async _generateVisualizationsSection(visualizations) {
        let html = '<div class="section"><h2>數據可視化</h2>';

        visualizations.forEach((viz, index) => {
            html += `<div class="chart-container" id="chart-${index}"></div>`;
        });

        html += '</div>';
        return html;
    }

    async _generateActionItemsSection(reportData) {
        const actionItems = reportData.insights
            ?.filter(insight => insight.actionItems && insight.actionItems.length > 0)
            .flatMap(insight => insight.actionItems) || [];

        if (actionItems.length === 0) {
            return '';
        }

        return `
            <div class="section">
                <h2>行動項目</h2>
                <ul class="action-items">
                    ${actionItems.map(action => `
                        <li class="action-item">
                            <h4>${action.title}</h4>
                            <div class="action-meta">
                                優先級: ${action.priority} |
                                截止日期: ${new Date(action.dueDate).toLocaleDateString('zh-TW')} |
                                負責人: ${action.assignee}
                            </div>
                            ${action.description ? `<p>${action.description}</p>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    _generateScripts(reportData) {
        if (!reportData.visualizations) {
            return '';
        }

        return `
            <script>
            document.addEventListener('DOMContentLoaded', function() {
                ${reportData.visualizations.map((viz, index) => `
                    const ctx${index} = document.getElementById('chart-${index}').getContext('2d');
                    new Chart(ctx${index}, ${JSON.stringify(viz)});
                `).join('')}
            });
            </script>
        `;
    }
}

/**
 * 報告生成器主類
 */
class ReportGenerator extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            enableVisualization: options.enableVisualization !== false,
            supportedFormats: options.supportedFormats || [
                REPORT_FORMATS.JSON,
                REPORT_FORMATS.MARKDOWN,
                REPORT_FORMATS.HTML
            ],
            outputDirectory: options.outputDirectory || './reports',
            maxReportSize: options.maxReportSize || 50 * 1024 * 1024, // 50MB
            ...options
        };

        // 核心組件
        this.templateManager = new ReportTemplateManager();
        this.visualizationGenerator = new VisualizationGenerator(this.options);

        // 格式化器
        this.formatters = new Map([
            [REPORT_FORMATS.JSON, new JSONFormatter()],
            [REPORT_FORMATS.MARKDOWN, new MarkdownFormatter()],
            [REPORT_FORMATS.HTML, new HTMLFormatter()]
        ]);

        // 統計信息
        this.stats = {
            totalReports: 0,
            reportsByFormat: Object.fromEntries(
                Object.values(REPORT_FORMATS).map(format => [format, 0])
            ),
            averageGenerationTime: 0,
            totalSize: 0
        };

        this.initialized = false;
    }

    /**
     * 初始化報告生成器
     */
    async initialize() {
        try {
            // 確保輸出目錄存在
            await this._ensureOutputDirectory();

            this.initialized = true;
            this.emit('initialized');
        } catch (error) {
            throw new Error(`ReportGenerator初始化失敗: ${error.message}`);
        }
    }

    /**
     * 生成報告
     */
    async generate(data, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        try {
            // 預處理數據
            const reportData = await this._preprocessData(data, options);

            // 選擇模板
            const template = this._selectTemplate(options);

            // 生成可視化
            if (this.options.enableVisualization && template.includeVisualizations) {
                reportData.visualizations = await this._generateVisualizations(reportData);
            }

            // 生成執行摘要
            reportData.executiveSummary = await this._generateExecutiveSummary(reportData);

            // 生成技術細節
            if (template.sections.includes('technical_details')) {
                reportData.technicalDetails = await this._generateTechnicalDetails(data, options);
            }

            // 格式化報告
            const formatter = this._getFormatter(options.format || template.format);
            const formattedReport = await formatter.format(reportData, template);

            // 保存報告
            let reportPath = null;
            if (options.save !== false) {
                reportPath = await this._saveReport(formattedReport, template.format, options);
            }

            // 更新統計
            const generationTime = Date.now() - startTime;
            this._updateStats(template.format, formattedReport.length, generationTime);

            this.emit('reportGenerated', {
                format: template.format,
                size: formattedReport.length,
                generationTime,
                path: reportPath
            });

            return {
                content: formattedReport,
                format: template.format,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    generationTime,
                    size: formattedReport.length,
                    template: template.name,
                    path: reportPath
                },
                stats: this.getStats()
            };

        } catch (error) {
            this.emit('generationFailed', { error: error.message });
            throw error;
        }
    }

    /**
     * 註冊自定義模板
     */
    registerTemplate(name, template) {
        this.templateManager.registerTemplate(name, template);
    }

    /**
     * 註冊自定義格式化器
     */
    registerFormatter(format, formatter) {
        this.formatters.set(format, formatter);
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return { ...this.stats };
    }

    // 私有方法

    /**
     * 預處理數據
     * @private
     */
    async _preprocessData(data, options) {
        const reportData = {
            title: options.title || '結果整合分析報告',
            metadata: {
                generatedAt: new Date().toISOString(),
                inputCount: data.metadata?.inputCount || 0,
                processingTime: data.metadata?.processingTime || 0,
                qualityScore: data.qualityScore || 0
            },
            ...data
        };

        // 處理洞察數據
        if (data.insights) {
            reportData.insights = Array.isArray(data.insights) ? data.insights : data.insights.insights || [];
        }

        // 處理趨勢數據
        if (data.trends) {
            reportData.trends = data.trends;
        }

        // 處理異常數據
        if (data.anomalies) {
            reportData.anomalies = data.anomalies;
        }

        // 處理衝突數據
        if (data.conflicts) {
            reportData.conflicts = data.conflicts;
        }

        return reportData;
    }

    /**
     * 選擇報告模板
     * @private
     */
    _selectTemplate(options) {
        const templateName = options.template || 'comprehensive';
        const template = this.templateManager.getTemplate(templateName);

        if (!template) {
            throw new Error(`未知的報告模板: ${templateName}`);
        }

        // 應用自定義選項
        return {
            ...template,
            ...options.templateOverrides
        };
    }

    /**
     * 生成可視化
     * @private
     */
    async _generateVisualizations(reportData) {
        const visualizations = [];

        // 洞察分佈圖
        if (reportData.insights && reportData.insights.length > 0) {
            const distributionChart = this.visualizationGenerator.generateInsightDistribution(reportData.insights);
            visualizations.push(distributionChart);

            // 優先級熱力圖
            const heatmapChart = this.visualizationGenerator.generatePriorityHeatmap(reportData.insights);
            visualizations.push(heatmapChart);
        }

        // 趨勢圖表
        if (reportData.trends?.shortTerm && reportData.trends.shortTerm.length > 0) {
            const trendChart = this.visualizationGenerator.generateTrendChart(reportData.trends.shortTerm);
            visualizations.push(trendChart);
        }

        // 時間線圖表
        if (reportData.insights && reportData.insights.length > 0) {
            const timelineChart = this.visualizationGenerator.generateTimeline(
                reportData.insights.map(insight => ({
                    timestamp: insight.metadata.generatedAt,
                    title: insight.title,
                    confidence: insight.confidence,
                    type: insight.type
                }))
            );
            visualizations.push(timelineChart);
        }

        return visualizations;
    }

    /**
     * 生成執行摘要
     * @private
     */
    async _generateExecutiveSummary(reportData) {
        const summary = {
            summary: '',
            keyPoints: [],
            metrics: {}
        };

        // 基本統計
        const insightCount = reportData.insights?.length || 0;
        const highPriorityCount = reportData.insights?.filter(i => i.priority.level >= 3).length || 0;
        const avgConfidence = insightCount > 0 ?
            reportData.insights.reduce((sum, i) => sum + i.confidence, 0) / insightCount : 0;

        // 生成摘要文本
        if (insightCount > 0) {
            summary.summary = `本次分析共生成 ${insightCount} 個洞察，其中 ${highPriorityCount} 個為高優先級洞察。`;
            summary.summary += `整體分析信心度為 ${(avgConfidence * 100).toFixed(1)}%。`;

            if (reportData.anomalies && reportData.anomalies.length > 0) {
                summary.summary += ` 檢測到 ${reportData.anomalies.length} 個異常情況需要關注。`;
            }

            if (reportData.conflicts && reportData.conflicts.detectedConflicts?.length > 0) {
                summary.summary += ` 發現 ${reportData.conflicts.detectedConflicts.length} 個數據衝突並已處理。`;
            }
        } else {
            summary.summary = '本次分析未發現明顯的模式或異常，系統運行正常。';
        }

        // 關鍵要點
        if (highPriorityCount > 0) {
            summary.keyPoints.push(`發現 ${highPriorityCount} 個需要立即關注的高優先級洞察`);
        }

        if (avgConfidence > 0.8) {
            summary.keyPoints.push('分析結果具有高信心度，建議採取相應行動');
        } else if (avgConfidence < 0.6) {
            summary.keyPoints.push('分析結果信心度較低，建議收集更多數據');
        }

        if (reportData.trends?.shortTerm && reportData.trends.shortTerm.length > 0) {
            const trendCount = reportData.trends.shortTerm.length;
            summary.keyPoints.push(`識別出 ${trendCount} 個短期趨勢模式`);
        }

        // 指標
        summary.metrics = {
            totalInsights: insightCount,
            highPriorityInsights: highPriorityCount,
            averageConfidence: avgConfidence,
            anomaliesDetected: reportData.anomalies?.length || 0,
            conflictsResolved: reportData.conflicts?.resolvedConflicts?.length || 0
        };

        return summary;
    }

    /**
     * 生成技術細節
     * @private
     */
    async _generateTechnicalDetails(data, options) {
        return {
            processing: {
                totalTime: data.metadata?.processingTime || 0,
                fusionTime: data.metadata?.fusionTime || 0,
                insightTime: data.metadata?.insightTime || 0,
                reportTime: Date.now() - (data.metadata?.startTime || Date.now())
            },
            quality: {
                overall: data.qualityScore || 0,
                accuracy: data.quality?.accuracy || 0,
                completeness: data.quality?.completeness || 0,
                consistency: data.quality?.consistency || 0
            },
            system: {
                version: '1.0.0',
                generatedBy: 'ResultIntegrator',
                environment: process.env.NODE_ENV || 'development'
            }
        };
    }

    /**
     * 獲取格式化器
     * @private
     */
    _getFormatter(format) {
        const formatter = this.formatters.get(format);
        if (!formatter) {
            throw new Error(`不支持的報告格式: ${format}`);
        }
        return formatter;
    }

    /**
     * 保存報告
     * @private
     */
    async _saveReport(content, format, options) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = options.filename || `report_${timestamp}.${format}`;
        const filepath = path.join(this.options.outputDirectory, filename);

        await fs.writeFile(filepath, content, 'utf8');
        return filepath;
    }

    /**
     * 確保輸出目錄存在
     * @private
     */
    async _ensureOutputDirectory() {
        try {
            await fs.mkdir(this.options.outputDirectory, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * 更新統計信息
     * @private
     */
    _updateStats(format, size, generationTime) {
        this.stats.totalReports++;
        this.stats.reportsByFormat[format]++;
        this.stats.totalSize += size;

        // 更新平均生成時間
        const currentAvg = this.stats.averageGenerationTime;
        const total = this.stats.totalReports;
        this.stats.averageGenerationTime = (currentAvg * (total - 1) + generationTime) / total;
    }

    /**
     * 清理資源
     */
    async dispose() {
        this.removeAllListeners();
    }
}

module.exports = {
    ReportGenerator,
    REPORT_FORMATS,
    REPORT_TYPES,
    CHART_TYPES
};