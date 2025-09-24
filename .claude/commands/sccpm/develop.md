# /sccpm:develop - Development Execution & Orchestration / 開發執行與協調

## 觸發條件 Triggers / 觸發條件
- Issues ready for development execution / Issues 準備進行開發執行
- Need CCPM-driven multi-agent parallel development / 需要 CCPM 驅動的多代理並行開發
- Complex high-quality development workflow orchestration / 複雜高品質開發工作流程協調

## 行為流程 Behavioral Flow / 行為流程
1. **CCPM Development Coordination / CCPM 開發協調**: Use /pm:epic-start for parallel development initiation / 使用 /pm:epic-start 進行並行開發啟動
2. **SuperClaude Implementation Engine / SuperClaude 實作引擎**: Use /sc:implement for high-quality code generation / 使用 /sc:implement 進行高品質代碼生成
3. **SuperClaude Architecture Validation / SuperClaude 架構驗證**: Use /sc:analyze for code quality and architecture review / 使用 /sc:analyze 進行代碼品質和架構審查
4. **SuperClaude Testing & Quality / SuperClaude 測試與品質**: Use /sc:test for comprehensive testing execution / 使用 /sc:test 進行全面測試執行
5. **SuperClaude Build & Integration / SuperClaude 構建與整合**: Use /sc:build for optimized build and deployment / 使用 /sc:build 進行優化構建和部署
6. **CCPM Progress Monitoring / CCPM 進度監控**: Real-time progress tracking and dynamic resource allocation / 即時進度追蹤和動態資源分配

核心行為 Core Behaviors / 核心行為：
- CCPM orchestrates multi-agent parallel development / CCPM 協調多代理並行開發
- SuperClaude agents provide specialized high-efficiency execution / SuperClaude 代理提供專業化高效執行
- Intelligent load balancing and resource optimization / 智能負載均衡和資源優化
- Real-time quality assurance and performance monitoring / 即時品質保證和性能監控

## 使用範例 Usage Examples / 使用範例

```bash
# Balanced multi-agent development / 平衡多代理開發
/sccpm:develop "交易機器人系統" --mode balanced --agents 5

# Intensive high-performance development / 集約高性能開發
/sccpm:develop "AI交易引擎" --mode intensive --agents 8 --focus performance

# Quality-first development approach / 品質優先開發方法
/sccpm:develop "風險管理系統" --quality-first --extensive-testing

# Parallel feature development with GitHub integration / 並行功能開發與 GitHub 整合
/sccpm:develop "用戶介面" --parallel-features --github-sync --auto-pr

# Game development with specialized agents / 遊戲開發專用代理
/sccpm:develop "epic-01-puzzle-strategy-system" --mode balanced --agents 6 --focus game-logic --github-integration
```

Execute the complete development execution and orchestration workflow:
執行完整的開發執行與協調工作流程：

Run `bash .claude/scripts/sccpm/develop.sh "$@"` using a sub-agent and show me the complete output.

- DO NOT truncate. / 不要截斷
- DO NOT collapse. / 不要摺疊
- DO NOT abbreviate. / 不要縮寫
- Show ALL lines in full. / 顯示所有完整行
- DO NOT print any other comments. / 不要印出任何其他評論