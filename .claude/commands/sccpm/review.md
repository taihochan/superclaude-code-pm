# /sccpm:review - Code Review & Quality Enhancement / 代碼審查與品質提升

## 觸發條件 Triggers / 觸發條件
- Comprehensive code review execution required / 需要執行全面代碼審查
- Quality enhancement and best practices validation / 品質提升與最佳實踐驗證
- Pre-merge code analysis and approval workflow / 合併前代碼分析與審批工作流程
- CCPM review coordination + SuperClaude expert analysis / CCPM 審查協調 + SuperClaude 專家分析

## 行為流程 Behavioral Flow / 行為流程
1. **CCPM Review Coordination / CCPM 審查協調**: Use /pm:status for review planning and assignment / 使用 /pm:status 進行審查規劃與分配
2. **SuperClaude Code Analysis / SuperClaude 代碼分析**: Use /sc:analyze for comprehensive code quality assessment / 使用 /sc:analyze 進行全面代碼品質評估
3. **SuperClaude Architecture Review / SuperClaude 架構審查**: Use /sc:spec-panel for architectural compliance validation / 使用 /sc:spec-panel 進行架構合規性驗證
4. **SuperClaude Security Review / SuperClaude 安全審查**: Use /sc:troubleshoot for security vulnerability detection / 使用 /sc:troubleshoot 進行安全漏洞檢測
5. **SuperClaude Improvement Suggestions / SuperClaude 改善建議**: Use /sc:improve for optimization recommendations / 使用 /sc:improve 進行優化建議
6. **CCPM Review Report Integration / CCPM 審查報告整合**: Generate comprehensive review report and approval workflow / 生成全面審查報告與審批工作流程

核心行為 Core Behaviors / 核心行為：
- CCPM orchestrates systematic code review across multiple dimensions / CCPM 協調多維度系統性代碼審查
- SuperClaude provides expert-level analysis and improvement recommendations / SuperClaude 提供專家級分析與改善建議
- Multi-expert review panel with specialized domain knowledge / 具備專業領域知識的多專家審查團隊
- Automated quality gates and approval workflow integration / 自動化品質門檻與審批工作流程整合

## 使用範例 Usage Examples / 使用範例

```bash
# Comprehensive code review for pull request / PR的全面代碼審查
/sccpm:review --pull-request 123 --comprehensive

# Security-focused review / 安全導向審查
/sccpm:review src/ --focus security --vulnerability-scan

# Architecture compliance review / 架構合規性審查
/sccpm:review --architecture --design-patterns --best-practices

# Performance optimization review / 性能優化審查
/sccpm:review --performance --bottleneck-detection --optimization

# Pre-release quality review / 發布前品質審查
/sccpm:review --release-ready --quality-gates --approval-workflow
```

Execute the complete code review and quality enhancement workflow:
執行完整的代碼審查與品質提升工作流程：

Run `bash .claude/scripts/sccpm/review.sh "$@"` using a sub-agent and show me the complete output.

- DO NOT truncate. / 不要截斷
- DO NOT collapse. / 不要摺疊
- DO NOT abbreviate. / 不要縮寫
- Show ALL lines in full. / 顯示所有完整行
- DO NOT print any other comments. / 不要印出任何其他評論