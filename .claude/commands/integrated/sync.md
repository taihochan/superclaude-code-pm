# /integrated:sync - CCPM+SuperClaude 狀態同步

## 觸發條件
- CCPM 和 SuperClaude 狀態不一致時
- 項目進度更新後需要同步分析結果
- 定期維護和狀態校正需求

## 行為流程
1. **檢測**: 識別 CCPM 和 SuperClaude 之間的狀態差異
2. **分析**: 確定同步策略和優先級
3. **執行**: 執行狀態同步操作
4. **驗證**: 確認同步完成和一致性

核心行為：
- 雙向狀態同步
- 智能衝突解決
- 數據一致性保證

Run `bash .claude/scripts/integrated/sync.sh` using a sub-agent and show me the complete output.

- DO NOT truncate.
- DO NOT collapse.
- DO NOT abbreviate.
- Show ALL lines in full.
- DO NOT print any other comments.