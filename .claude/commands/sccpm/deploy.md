# /sccpm:deploy - Deployment Pipeline & Release Management / 部署管道與發布管理

## 觸發條件 Triggers / 觸發條件
- Production deployment execution required / 需要執行生產部署
- Release pipeline orchestration and management / 發布管道協調與管理
- Multi-environment deployment coordination / 多環境部署協調
- CCPM deployment coordination + SuperClaude build optimization / CCPM 部署協調 + SuperClaude 構建優化

## 行為流程 Behavioral Flow / 行為流程
1. **CCPM Deployment Coordination / CCPM 部署協調**: Use /pm:sync for deployment planning and tracking / 使用 /pm:sync 進行部署規劃與追蹤
2. **SuperClaude Build Optimization / SuperClaude 構建優化**: Use /sc:build for optimized production builds / 使用 /sc:build 進行優化生產構建
3. **SuperClaude Infrastructure Validation / SuperClaude 基礎設施驗證**: Use /sc:analyze for infrastructure readiness check / 使用 /sc:analyze 進行基礎設施就緒檢查
4. **SuperClaude Deployment Execution / SuperClaude 部署執行**: Use /sc:task for automated deployment orchestration / 使用 /sc:task 進行自動化部署協調
5. **SuperClaude Health Monitoring / SuperClaude 健康監控**: Use /sc:troubleshoot for post-deployment validation / 使用 /sc:troubleshoot 進行部署後驗證
6. **CCPM Release Management / CCPM 發布管理**: Complete release tracking and stakeholder notification / 完成發布追蹤和利害關係人通知

核心行為 Core Behaviors / 核心行為：
- CCPM orchestrates comprehensive deployment across environments / CCPM 協調跨環境的綜合部署
- SuperClaude provides specialized deployment optimization and automation / SuperClaude 提供專業部署優化與自動化
- Multi-stage deployment pipeline with automated rollback capabilities / 多階段部署管道與自動回滾能力
- Real-time monitoring and health validation throughout deployment process / 部署過程中的即時監控與健康驗證

## 使用範例 Usage Examples / 使用範例

```bash
# Production deployment with full pipeline / 完整管道生產部署
/sccpm:deploy production --full-pipeline --health-checks

# Staging environment deployment / 測試環境部署
/sccpm:deploy staging --quick-deploy --smoke-tests

# Blue-green deployment strategy / 藍綠部署策略
/sccpm:deploy production --blue-green --zero-downtime

# Rollback to previous version / 回滾到先前版本
/sccpm:deploy production --rollback --version v1.2.3

# Multi-environment deployment / 多環境部署
/sccpm:deploy --environments "staging,production" --sequential
```

Execute the complete deployment pipeline and release management workflow:
執行完整的部署管道與發布管理工作流程：

Run `bash .claude/scripts/sccpm/deploy.sh "$@"` using a sub-agent and show me the complete output.

- DO NOT truncate. / 不要截斷
- DO NOT collapse. / 不要摺疊
- DO NOT abbreviate. / 不要縮寫
- Show ALL lines in full. / 顯示所有完整行
- DO NOT print any other comments. / 不要印出任何其他評論