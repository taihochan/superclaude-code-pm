# /sccpm:analyze - Deep Code Analysis & Architecture Review / 深度代碼分析與架構審查

## 觸發條件 Triggers / 觸發條件
- Code quality assessment required / 需要代碼品質評估
- Architecture review and validation / 架構審查與驗證
- Security vulnerability assessment / 安全漏洞評估
- Performance optimization analysis / 性能優化分析
- CCPM tracking + SuperClaude expert analysis / CCPM 追蹤 + SuperClaude 專家分析

## 行為流程 Behavioral Flow / 行為流程
1. **CCPM Analysis Coordination / CCPM 分析協調**: Use /pm:status for current project analysis / 使用 /pm:status 進行當前專案分析
2. **SuperClaude Deep Code Analysis / SuperClaude 深度代碼分析**: Use /sc:analyze for comprehensive code review / 使用 /sc:analyze 進行全面代碼審查
3. **SuperClaude Architecture Validation / SuperClaude 架構驗證**: Use /sc:spec-panel for architectural compliance / 使用 /sc:spec-panel 進行架構合規性檢查
4. **SuperClaude Security Assessment / SuperClaude 安全評估**: Use /sc:troubleshoot for vulnerability detection / 使用 /sc:troubleshoot 進行漏洞檢測
5. **SuperClaude Performance Analysis / SuperClaude 性能分析**: Use /sc:analyze --focus performance for optimization / 使用 /sc:analyze --focus performance 進行優化
6. **CCPM Report Integration / CCPM 報告整合**: Integrate all analysis results for project tracking / 整合所有分析結果進行專案追蹤

核心行為 Core Behaviors / 核心行為：
- CCPM coordinates comprehensive analysis across multiple domains / CCPM 協調跨多個領域的全面分析
- SuperClaude provides expert-level analysis in specialized areas / SuperClaude 提供專業領域的專家級分析
- Multi-dimensional quality assessment with actionable recommendations / 多維度品質評估與可執行建議
- Real-time integration with project management workflow / 與專案管理工作流程的即時整合

## 使用範例 Usage Examples / 使用範例

```bash
# Comprehensive project analysis / 全面專案分析
/sccpm:analyze src/ --comprehensive --all-domains

# Security-focused analysis / 安全導向分析
/sccpm:analyze --focus security --vulnerability-scan

# Performance optimization analysis / 性能優化分析
/sccpm:analyze --focus performance --bottleneck-detection

# Architecture compliance review / 架構合規性審查
/sccpm:analyze --architecture-review --design-patterns

# Code quality and maintainability / 代碼品質與可維護性
/sccpm:analyze --quality-metrics --technical-debt
```

Execute the complete deep code analysis and architecture review workflow:
執行完整的深度代碼分析與架構審查工作流程：

Run `bash .claude/scripts/sccpm/analyze.sh "$@"` using a sub-agent and show me the complete output.

- DO NOT truncate. / 不要截斷
- DO NOT collapse. / 不要摺疊
- DO NOT abbreviate. / 不要縮寫
- Show ALL lines in full. / 顯示所有完整行
- DO NOT print any other comments. / 不要印出任何其他評論