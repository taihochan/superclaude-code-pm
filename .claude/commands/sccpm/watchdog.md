# /sccpm:watchdog - SCCPM 會話監控與強制回歸系統

## 🛡️ 守護者模式 - Session Persistence Guardian

### 功能描述 / Description
監控 Claude Code 會話狀態，當偏離 SCCPM 指令行為時自動觸發強制回歸機制，確保多 Agent 系統持續運作。

**工作流程 / Workflow:**
```
會話監控 → 狀態檢測 → 偏離警告 → 強制回歸 → Agent 重新啟動
Session Monitor → State Detection → Deviation Alert → Force Recovery → Agent Restart
```

### 使用方法 / Usage

#### 基礎守護模式 / Basic Guardian Mode
```bash
# 啟動會話守護者（自動監控模式）
/sccpm:watchdog --monitor-session --auto-recovery

# 手動觸發強制回歸
/sccpm:watchdog --force-recovery --restore-agents 12
```

#### 進階守護配置 / Advanced Guardian Configuration
```bash
# 完整企業級守護系統
/sccpm:watchdog \
    --monitor-session \
    --check-interval 30 \
    --deviation-threshold 3 \
    --auto-recovery \
    --restore-context \
    --agent-count 12 \
    --compliance-mode strict \
    --notification-level verbose \
    --recovery-strategy aggressive
```

#### 與開發指令整合 / Integration with Development Commands
```bash
# 啟動開發指令並自動附加守護者
/sccpm:develop-ultimate "web-platform" \
    --mode enterprise \
    --agents 12 \
    --watchdog-enabled \
    --auto-recovery-interval 60

# 守護者會自動在背景運行，確保會話持續性
```

### 監控參數 / Monitoring Parameters

#### 會話狀態檢測 / Session State Detection
- `--check-interval <seconds>` - 檢查間隔（預設：30 秒）
- `--deviation-threshold <count>` - 偏離次數閾值（預設：3 次）
- `--context-loss-detection` - 上下文丟失檢測
- `--agent-status-monitoring` - Agent 狀態監控

#### 回歸策略 / Recovery Strategy
- `--recovery-strategy <mode>` - 回歸策略：gentle | normal | aggressive
- `--restore-context` - 恢復完整上下文
- `--agent-restart-mode` - Agent 重啟模式：preserve | fresh
- `--state-persistence` - 狀態持久化保存

#### 通知等級 / Notification Level
- `--notification-level <level>` - 通知等級：silent | normal | verbose
- `--alert-channels` - 警告通道配置
- `--recovery-logging` - 回歸過程記錄

### 使用場景 / Use Cases

#### 1. 長時間開發會話保護 / Long Development Session Protection
```bash
# 啟動 8 小時企業開發會話的完整保護
/sccpm:watchdog \
    --monitor-session \
    --session-duration 480 \
    --check-interval 30 \
    --auto-recovery \
    --state-backup-interval 300 \
    --agent-health-check
```

#### 2. 關鍵任務開發監控 / Critical Mission Development Monitoring
```bash
# 金融系統開發的嚴格監控
/sccpm:watchdog \
    --monitor-session \
    --compliance-mode strict \
    --deviation-threshold 1 \
    --recovery-strategy aggressive \
    --backup-context continuous \
    --alert-channels max
```

#### 3. 團隊協作會話同步 / Team Collaboration Session Sync
```bash
# 多人協作時的會話狀態同步
/sccpm:watchdog \
    --monitor-session \
    --team-sync-mode \
    --shared-context \
    --recovery-coordination \
    --conflict-resolution auto
```

### 技術實現原理 / Technical Implementation

#### 狀態檢測機制 / State Detection Mechanism
1. **上下文完整性檢查** - Context Integrity Check
2. **Agent 響應驗證** - Agent Response Verification
3. **指令執行追蹤** - Command Execution Tracking
4. **會話連續性監控** - Session Continuity Monitoring

#### 強制回歸流程 / Force Recovery Process
1. **偏離檢測** - Deviation Detection
2. **狀態快照** - State Snapshot
3. **Agent 重新啟動** - Agent Restart
4. **上下文恢復** - Context Restoration
5. **指令重新執行** - Command Re-execution

### 整合範例 / Integration Examples

#### 與 develop-ultimate 整合 / Integration with develop-ultimate
```bash
# 自動附加守護者的終極開發模式
/sccpm:develop-ultimate "web-platform" \
    --mode enterprise \
    --agents 12 \
    --quality-gates strict \
    --watchdog-auto-attach \
    --recovery-on-deviation \
    --state-persistence enabled
```

#### 守護者狀態查詢 / Watchdog Status Query
```bash
# 查詢當前守護者狀態
/sccpm:watchdog --status --detailed

# 查詢會話健康度報告
/sccpm:watchdog --health-report --session-analysis
```

### 最佳實踐 / Best Practices

#### 企業級會話管理 / Enterprise Session Management
- ✅ 始終啟用自動回歸模式
- ✅ 設定適當的檢查間隔（30-60 秒）
- ✅ 啟用完整狀態備份
- ✅ 配置多重警告通道

#### 開發效率優化 / Development Efficiency Optimization
- ✅ 使用 aggressive 回歸策略處理關鍵任務
- ✅ 啟用上下文持久化避免重複設定
- ✅ 配置 Agent 狀態監控確保並行效率
- ✅ 設定會話時長保護避免超時中斷

---

**注意事項 / Notes:**
- 守護者會在背景持續運行，不會干擾正常開發流程
- 支援與所有 SCCPM 指令無縫整合
- 提供完整的會話恢復和 Agent 重啟機制
- 適用於長時間、高強度的企業級開發場景

**相關指令 / Related Commands:**
- `/sccmp:develop-ultimate` - 終極開發模式（可自動附加守護者）
- `/sccmp:status` - 系統狀態查詢
- `/sccpm:orchestrate` - 多 Agent 協調管理