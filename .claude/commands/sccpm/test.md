# /sccpm:test - Comprehensive Testing & Quality Assurance / 綜合測試與品質保證

## 觸發條件 Triggers / 觸發條件
- Comprehensive testing execution required / 需要執行綜合測試
- Quality assurance and coverage analysis / 品質保證與覆蓋率分析
- Automated testing pipeline orchestration / 自動化測試管道協調
- CCPM test coordination + SuperClaude testing expertise / CCPM 測試協調 + SuperClaude 測試專業

## 行為流程 Behavioral Flow / 行為流程
1. **CCPM Test Coordination / CCMP 測試協調**: Use /pm:status for test planning and coordination / 使用 /pm:status 進行測試規劃與協調
2. **SuperClaude Test Execution / SuperClaude 測試執行**: Use /sc:test for comprehensive test suite execution / 使用 /sc:test 進行全面測試套件執行
3. **SuperClaude Coverage Analysis / SuperClaude 覆蓋率分析**: Use /sc:analyze for test coverage assessment / 使用 /sc:analyze 進行測試覆蓋率評估
4. **SuperClaude Performance Testing / SuperClaude 性能測試**: Use /sc:test --focus performance for load and stress testing / 使用 /sc:test --focus performance 進行負載與壓力測試
5. **SuperClaude E2E Testing / SuperClaude 端到端測試**: Use /sc:test --playwright for browser-based testing / 使用 /sc:test --playwright 進行瀏覽器測試
6. **CCPM Quality Report Integration / CCPM 品質報告整合**: Integrate all testing results into project quality metrics / 將所有測試結果整合到專案品質指標

核心行為 Core Behaviors / 核心行為：
- CCPM orchestrates comprehensive testing across all layers / CCPM 協調所有層級的綜合測試
- SuperClaude provides specialized testing expertise and execution / SuperClaude 提供專業測試專長與執行
- Multi-dimensional quality assurance with detailed coverage analysis / 多維度品質保證與詳細覆蓋率分析
- Automated CI/CD pipeline integration with quality gates / 自動化 CI/CD 管道整合與品質門檻

## 使用範例 Usage Examples / 使用範例

```bash
# Comprehensive test suite execution / 全面測試套件執行
/sccpm:test --comprehensive --all-types

# Focus on specific test types / 專注特定測試類型
/sccpm:test --focus "unit,integration" --coverage-report

# Performance and load testing / 性能與負載測試
/sccpm:test --performance --load-testing --stress-testing

# End-to-end browser testing / 端到端瀏覽器測試
/sccpm:test --e2e --browser-testing --visual-regression

# Security and vulnerability testing / 安全與漏洞測試
/sccpm:test --security --penetration-testing
```

Execute the complete comprehensive testing and quality assurance workflow:
執行完整的綜合測試與品質保證工作流程：

Run `bash .claude/scripts/sccpm/test.sh "$@"` using a sub-agent and show me the complete output.

- DO NOT truncate. / 不要截斷
- DO NOT collapse. / 不要摺疊
- DO NOT abbreviate. / 不要縮寫
- Show ALL lines in full. / 顯示所有完整行
- DO NOT print any other comments. / 不要印出任何其他評論