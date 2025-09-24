# /sccpm:issue - Issue Management & Enhancement / Issue 管理與增強

## 觸發條件 Triggers / 觸發條件
- EPIC completed and ready for Issue generation / EPIC 完成並準備進行 Issue 生成
- Need intelligent Issue creation with technical enhancement / 需要智能 Issue 創建與技術增強
- CCPM Issue management + SuperClaude technical optimization / CCPM Issue 管理 + SuperClaude 技術優化

## 行為流程 Behavioral Flow / 行為流程
1. **CCPM Issue Generation / CCPM Issue 生成**: Use /pm:issue-start for systematic Issue creation / 使用 /pm:issue-start 進行系統性 Issue 創建
2. **SuperClaude Workflow Enhancement / SuperClaude 工作流程增強**: Use /sc:workflow for implementation workflow optimization / 使用 /sc:workflow 進行實施工作流程優化
3. **SuperClaude Technical Specification / SuperClaude 技術規格**: Use /sc:implement for technical implementation guidance / 使用 /sc:implement 進行技術實施指導
4. **SuperClaude Estimation & Planning / SuperClaude 評估與規劃**: Use /sc:estimate for accurate development estimation / 使用 /sc:estimate 進行準確開發評估
5. **CCPM Issue Synchronization / CCPM Issue 同步**: Use /pm:issue-sync for GitHub integration / 使用 /pm:issue-sync 進行 GitHub 整合
6. **Intelligent Assignment & Tracking / 智能分配與追蹤**: Automated developer assignment and progress tracking / 自動開發者分配與進度追蹤

核心行為 Core Behaviors / 核心行為：
- CCPM leads systematic Issue lifecycle management / CCPM 主導系統性 Issue 生命週期管理
- SuperClaude provides technical depth and implementation clarity / SuperClaude 提供技術深度和實施清晰度
- Intelligent developer matching and task assignment / 智能開發者匹配和任務分配
- Real-time progress tracking and quality assurance / 即時進度追蹤和品質保證

## 使用範例 Usage Examples / 使用範例

```bash
# Basic Issue generation from EPIC / 從 EPIC 基本 Issue 生成
/sccpm:issue "交易機器人EPIC" --priority high

# Technical-focused Issue creation / 技術導向 Issue 創建
/sccpm:issue "AI交易引擎" --focus implementation --detailed-specs

# Agile story breakdown / 敏捷用戶故事分解
/sccpm:issue "用戶儀表板" --user-stories --acceptance-criteria

# Bug tracking and resolution / 錯誤追蹤與解決
/sccpm:issue "性能優化" --bug-analysis --root-cause
```

Execute the complete Issue management and enhancement workflow:
執行完整的 Issue 管理與增強工作流程：

Run `bash .claude/scripts/sccpm/issue.sh "$@"` using a sub-agent and show me the complete output.

- DO NOT truncate. / 不要截斷
- DO NOT collapse. / 不要摺疊
- DO NOT abbreviate. / 不要縮寫
- Show ALL lines in full. / 顯示所有完整行
- DO NOT print any other comments. / 不要印出任何其他評論