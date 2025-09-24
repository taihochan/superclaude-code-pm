# /sccpm:standup - Daily Progress & Team Reporting / 每日進度與團隊報告

## 觸發條件 Triggers / 觸發條件
- Daily standup meeting automation and reporting / 每日站立會議自動化與報告
- Team progress tracking and blockers identification / 團隊進度追蹤與障礙識別
- Sprint review and milestone assessment / 衝刺審查與里程碑評估
- CCPM progress coordination + SuperClaude insights generation / CCPM 進度協調 + SuperClaude 洞察生成

## 行為流程 Behavioral Flow / 行為流程
1. **CCPM Progress Aggregation / CCPM 進度匯集**: Use /pm:standup for project status aggregation / 使用 /pm:standup 進行專案狀態匯集
2. **SuperClaude Performance Analysis / SuperClaude 性能分析**: Use /sc:analyze for team productivity insights / 使用 /sc:analyze 進行團隊生產力洞察
3. **SuperClaude Trend Analysis / SuperClaude 趋勢分析**: Use /sc:reflect for sprint retrospective insights / 使用 /sc:reflect 進行衝刺回顧洞察
4. **SuperClaude Recommendation Engine / SuperClaude 建議引擎**: Use /sc:improve for process optimization suggestions / 使用 /sc:improve 進行流程優化建議
5. **SuperClaude Blockers Resolution / SuperClaude 障礙解決**: Use /sc:troubleshoot for impediment analysis / 使用 /sc:troubleshoot 進行障礙分析
6. **CCPM Executive Summary / CCPM 執行摘要**: Generate comprehensive stakeholder report / 生成全面利害關係人報告

核心行為 Core Behaviors / 核心行為：
- CCPM provides structured progress tracking and milestone management / CCPM 提供結構化進度追蹤與里程碑管理
- SuperClaude delivers intelligent insights and predictive analytics / SuperClaude 提供智能洞察與預測分析
- Automated standup report generation with actionable insights / 自動化站立報告生成與可執行洞察
- Real-time team performance monitoring and optimization recommendations / 即時團隊性能監控與優化建議

## 使用範例 Usage Examples / 使用範例

```bash
# Daily standup report generation / 每日站立報告生成
/sccpm:standup --daily --team-summary --blockers-analysis

# Weekly sprint review / 週度衝刺審查
/sccpm:standup --weekly --sprint-metrics --velocity-tracking

# Executive dashboard update / 執行儀表板更新
/sccpm:standup --executive --kpi-dashboard --milestone-progress

# Team performance analysis / 團隊性能分析
/sccpm:standup --performance --productivity-insights --optimization

# Retrospective and planning / 回顧與規劃
/sccpm:standup --retrospective --lessons-learned --next-sprint
```

Execute the complete daily progress and team reporting workflow:
執行完整的每日進度與團隊報告工作流程：

Run `bash .claude/scripts/sccpm/standup.sh "$@"` using a sub-agent and show me the complete output.

- DO NOT truncate. / 不要截斷
- DO NOT collapse. / 不要摺疊
- DO NOT abbreviate. / 不要縮寫
- Show ALL lines in full. / 顯示所有完整行
- DO NOT print any other comments. / 不要印出任何其他評論