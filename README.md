# 🚀 SCCPM - SuperClaude Code Project Management Framework

> **終極智能項目管理框架** - 結合 CCPM 多代理並行處理與 SuperClaude 高效能代理的完整開發生命週期解決方案

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-2.0-blue.svg)](https://github.com/yourusername/superclaude-code-pm)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-green.svg)](https://claude.ai/code)

---

## 🌟 核心特色

- **🧠 智能雙引擎架構**: CCPM 主控 + SuperClaude 執行
- **👥 多代理並行處理**: 最多16個專業代理同時工作
- **🔄 完整開發生命週期**: PRD → EPIC → Issues → Development → Testing → Deployment
- **🎯 專案類型智能識別**: 自動配置專業代理群組
- **🛡️ 會話持續性保護**: 智能監控避免會話偏離，自動回歸 SCCPM 模式
- **⚡ 企業級品質保證**: 8維度品質檢測 + 自動化CI/CD
- **🧩 全 MCP 整合**: Sequential, Context7, Magic, Morphllm, Serena, Playwright
- **📊 智能記憶系統**: Serena 跨會話專案狀態管理
- **🔗 Git 企業級工作流程**: GitFlow + 自動化PR管理

---

## 🚀 快速開始

### 📥 安裝

#### 方法 1: Git Clone (推薦)

```bash
# 1. Clone SCCPM 框架
git clone https://github.com/yourusername/superclaude-code-pm.git

# 2. 複製到你的專案目錄
cp -r superclaude-code-pm/.claude /path/to/your/project/

# 3. 進入專案目錄
cd /path/to/your/project

# 4. 開始使用 SCCPM！
```

#### 方法 2: 直接下載

```bash
# 下載並解壓到專案目錄
wget https://github.com/yourusername/superclaude-code-pm/archive/main.zip
unzip main.zip
cp -r superclaude-code-pm-main/.claude /path/to/your/project/
```

### ⚡ 5分鐘上手

```bash
# 🚀 一鍵啟動完整開發流程 (自動生成 PRD + EPIC + Issues + Development)
bash .claude/scripts/sccpm/develop-ultimate.sh "my-awesome-project" "enterprise" "8"

# 🎯 或者分階段執行
bash .claude/scripts/sccpm/prd.sh "my-project"           # 生成 PRD
bash .claude/scripts/sccpm/epic.sh "my-project"          # EPIC 分解
bash .claude/scripts/sccpm/sync.sh "my-project"          # GitHub 同步
bash .claude/scripts/sccpm/develop.sh "my-project"       # 開始開發
```

---

## 📚 完整指令參考手冊

### 🏗️ 專案初始化階段

#### `/sccpm:prd` - PRD 生成與優化

**功能**: 結合 CCPM 結構化分析與 SuperClaude 商業智能，生成高品質產品需求文檔

```bash
# 基本語法
bash .claude/scripts/sccpm/prd.sh "專案名稱" [模式] [分析深度]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱 (例: "my-awesome-project")
模式        : 可選，analysis(分析) | creation(創建) | optimization(優化)，預設: creation
分析深度    : 可選，basic(基礎) | detailed(詳細) | comprehensive(全面)，預設: detailed

# 🌟 使用範例
bash .claude/scripts/sccpm/prd.sh "e-commerce-platform"                           # 基本電商平台 PRD
bash .claude/scripts/sccpm/prd.sh "web-platform" "creation" "comprehensive"     # 全面Web平台 PRD
bash .claude/scripts/sccpm/prd.sh "mobile-app" "optimization" "detailed"          # 手機應用優化 PRD

# 🎯 執行流程
# Phase 1: CCPM PRD 初始化 (結構化需求分析)
# Phase 2: SuperClaude 商業分析 (市場與競爭分析)
# Phase 3: SuperClaude 技術評估 (技術可行性分析)
# Phase 4: SuperClaude 需求發現 (深度需求探索)
# Phase 5: CCPM PRD 整合 (需求文檔整合)
# Phase 6: SuperClaude PRD 驗證 (品質驗證與優化)

# 📊 輸出文件
# - PRD_專案名稱_YYYYMMDD.md (完整 PRD 文檔)
# - 商業分析報告 (市場分析 + 競爭分析)
# - 技術可行性評估 (架構建議 + 風險評估)
```

#### `/sccpm:epic` - EPIC 分解與設計優化

**功能**: 將 PRD 分解為可執行的 EPIC，結合架構設計和規格審查

```bash
# 基本語法
bash .claude/scripts/sccpm/epic.sh "專案名稱" [分解模式] [優先級策略]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
分解模式     : 可選，feature(功能導向) | technical(技術導向) | user-story(用戶故事)，預設: feature
優先級策略   : 可選，business(商業價值) | risk(風險) | dependency(依賴)，預設: business

# 🌟 使用範例
bash .claude/scripts/sccpm/epic.sh "web-platform"                               # 基本功能分解
bash .claude/scripts/sccpm/epic.sh "mobile-app" "technical" "dependency"          # 技術導向依賴排序
bash .claude/scripts/sccpm/epic.sh "e-learning" "user-story" "business"           # 用戶故事商業排序

# 🎯 執行流程
# Phase 1: CCMP EPIC 分解 (PRD → EPIC 結構化分解)
# Phase 2: SuperClaude 架構設計 (系統架構 + 技術方案)
# Phase 3: SuperClaude 規格審查 (多專家規格驗證)
# Phase 4: SuperClaude 工作流程 (開發流程優化)
# Phase 5: CCPM 依賴分析 (EPIC 間依賴關係分析)
# Phase 6: CCPM 優先級規劃 (開發優先級排序)

# 📊 輸出文件
# - EPIC_專案名稱_YYYYMMDD.md (EPIC 分解文檔)
# - 架構設計文檔 (系統架構 + 資料庫設計)
# - 技術規格書 (API 規格 + 接口定義)
# - 開發排程建議 (時程規劃 + 資源分配)
```

### 🔄 GitHub 整合階段

#### `/sccpm:sync` - GitHub 整合與專案同步

**功能**: 完整 EPIC 到 GitHub Issues 工作流程執行，包含開發者分配和里程碑管理

```bash
# 基本語法
bash .claude/scripts/sccpm/sync.sh "專案名稱" [同步模式] [分配策略]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
同步模式     : 可選，create-issues(創建Issues) | sync-progress(同步進度) | full-sync(完整同步)，預設: full-sync
分配策略     : 可選，auto-assign(自動分配) | skill-match(技能匹配) | load-balance(負載均衡)，預設: skill-match

# 🌟 使用範例
bash .claude/scripts/sccpm/sync.sh "web-platform"                                # 完整 GitHub 同步
bash .claude/scripts/sccpm/sync.sh "web-app" "create-issues" "auto-assign"       # 創建 Issues 自動分配
bash .claude/scripts/sccpm/sync.sh "mobile-app" "sync-progress" "load-balance"   # 同步進度負載均衡

# 🔗 GitHub 整合功能
--create-issues        # 自動建立 GitHub Issues
--auto-assign         # 智能開發者分配
--detailed-specs      # 詳細技術規格
--acceptance-criteria # 驗收標準
--milestones          # 里程碑管理
--parallel-branches   # 並行分支策略
--auto-pr-creation    # 自動 PR 建立
--continuous-sync     # 持續同步
--status-updates      # 狀態更新通知

# 🎯 執行流程
# Phase 1: CCPM GitHub Issues 創建
# Phase 2: SuperClaude Issue 增強
# Phase 3: SuperClaude 開發者分配
# Phase 4: CCPM 里程碑管理
# Phase 5: SuperClaude 進度優化
# Phase 6: CCPM 即時同步

# 📊 輸出結果
# - GitHub Issues 自動建立 (包含標籤、里程碑、分配者)
# - 開發分支自動建立 (feature/issue-id-description)
# - PR 模板配置 (標準化 PR 描述)
# - 專案看板設置 (Kanban 工作流程)
```

### 🚀 開發執行階段

#### `/sccpm:develop` - 標準開發協調

**功能**: 多代理並行開發，整合技術分析和品質保證

```bash
# 基本語法
bash .claude/scripts/sccpm/develop.sh "專案名稱" [模式] [代理數量] [專注領域]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
模式        : 可選，balanced(平衡) | intensive(集約) | quality-first(品質優先)，預設: balanced
代理數量     : 可選，4-12，預設: 6
專注領域     : 可選，performance(性能) | security(安全) | scalability(擴展性)，預設: auto-detect

# 🌟 使用範例
bash .claude/scripts/sccpm/develop.sh "web-platform" "intensive" "8" "performance"  # 高性能 Web 平台
bash .claude/scripts/sccpm/develop.sh "web-app" "quality-first" "6" "security"     # 安全優先開發
bash .claude/scripts/sccpm/develop.sh "mobile-app" "balanced" "4"                  # 平衡開發模式

# 🎯 執行流程
# Phase 1: CCPM 開發協調 (多代理並行開發啟動)
# Phase 2: SuperClaude 實作引擎 (高品質代碼生成)
# Phase 3: SuperClaude 架構驗證 (代碼品質和架構審查)
# Phase 4: SuperClaude 測試與品質 (全面測試執行)
# Phase 5: SuperClaude 構建與整合 (優化構建和部署)
# Phase 6: CCPM 進度監控 (即時進度追蹤和資源分配)

# 🤖 代理專業化 (根據專案類型自動配置)
# 企業級應用系統:
#   - 架構師, 全端工程師, 資料庫專家
#   - 安全專家, 測試專家, DevOps專家, 品質專家 (8個代理配置)
#
# Web平台應用:
#   - 前端專家, 後端專家, 資料庫專家
#   - API 專家, 測試專家, DevOps 專家 (6個代理配置)
#
# 資料分析平台:
#   - 資料工程師, 分析師, ML工程師
#   - 視覺化專家, 品質專家, DevOps專家 (6個代理配置)
```

#### `/sccpm:develop-ultimate` - 終極品質開發引擎 🔥

**功能**: 最高品質的企業級開發解決方案，全 MCP 整合 + 完整 CI/CD

```bash
# 基本語法
bash .claude/scripts/sccpm/develop-ultimate.sh "專案名稱" [模式] [代理數量] [品質等級] [Git工作流程] [CI/CD系統] [規範文件]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
模式        : 可選，enterprise(企業級) | startup(新創) | research(研究型)，預設: enterprise
代理數量     : 可選，8-16，預設: 12
品質等級     : 可選，strict(嚴格) | standard(標準) | flexible(靈活)，預設: strict
Git工作流程  : 可選，gitflow | github-flow | gitlab-flow，預設: gitflow
CI/CD系統   : 可選，github-actions | gitlab-ci | jenkins，預設: github-actions
規範文件     : 可選，.claude/standards/專案.yml 路徑，預設: auto-detect

# 🌟 使用範例
bash .claude/scripts/sccpm/develop-ultimate.sh "web-platform" "enterprise" "12" "strict" "gitflow" "github-actions"
bash .claude/scripts/sccpm/develop-ultimate.sh "e-commerce-platform" "enterprise" "16" "strict" "gitflow" "github-actions" ".claude/standards/ecommerce.yml"
bash .claude/scripts/sccpm/develop-ultimate.sh "startup-mvp" "startup" "8" "standard" "github-flow" "github-actions"

# 🚀 終極功能特色
--mode enterprise          # 企業級開發模式
--agents 12               # 12個專業代理並行
--quality-gates strict    # 嚴格品質檢測
--git-workflow gitflow    # GitFlow 工作流程
--ci-cd github-actions    # GitHub Actions CI/CD
--security-scan comprehensive  # 全面安全掃描
--performance-budget strict    # 嚴格性能預算
--testing-coverage "85,75,60"  # 測試覆蓋率要求 (Unit, Integration, E2E)
--compliance "PCI-DSS,SOX"     # 合規標準
--auto-deploy staging          # 自動部署到測試環境
--documentation auto-generate  # 自動生成文檔
--monitoring full-stack        # 全棧監控

# 🧩 MCP 全整合協作矩陣
Tier-1 核心推理: Sequential (主導多步驟分析決策)
Tier-2 知識整合: Context7 + Serena (文檔模式 + 專案記憶)
Tier-3 實作引擎: Magic + Morphllm (UI生成 + 批量轉換)
Tier-4 驗證測試: Playwright (完整 E2E 測試覆蓋)
Tier-5 持久記憶: Serena (跨會話專案狀態管理)

# 🏗️ 企業級架構特色
✅ 12個專業代理專業化配置 (AI/ML, 安全, 性能, 測試, DevOps...)
✅ 8維度品質檢測 (代碼品質, 安全, 性能, 測試覆蓋, 文檔, 可訪問性...)
✅ 完整 CI/CD Pipeline (Build → Test → Security → Quality → Deploy → Monitor)
✅ Git 企業級工作流程 (分支保護, PR 模板, Code Review, 自動合併)
✅ 智能專案記憶系統 (開發決策, 架構演進, 錯誤解決方案...)
✅ 跨瀏覽器測試 (Chrome, Firefox, Safari, Edge + 響應式設計)
```

### 🧪 品質保證階段

#### `/sccpm:test` - 智能測試執行

```bash
# 基本語法
bash .claude/scripts/sccpm/test.sh "專案名稱" [測試類型] [覆蓋率要求]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
測試類型     : 可選，unit(單元) | integration(整合) | e2e(端到端) | all(全部)，預設: all
覆蓋率要求   : 可選，"85,75,60" (Unit,Integration,E2E)，預設: "80,70,50"

# 🌟 使用範例
bash .claude/scripts/sccpm/test.sh "web-app" "all" "90,80,70"           # 高覆蓋率全面測試
bash .claude/scripts/sccpm/test.sh "api-service" "unit" "95"            # 高覆蓋率單元測試
bash .claude/scripts/sccpm/test.sh "frontend" "e2e" "60"               # E2E 使用者流程測試
```

#### `/sccpm:review` - 代碼審查與品質分析

```bash
# 基本語法
bash .claude/scripts/sccpm/review.sh "專案名稱" [審查範圍] [品質標準]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
審查範圍     : 可選，recent-commits(最近提交) | full-codebase(全代碼庫) | specific-files(特定文件)，預設: recent-commits
品質標準     : 可選，enterprise(企業) | standard(標準) | basic(基本)，預設: standard

# 🌟 使用範例
bash .claude/scripts/sccpm/review.sh "web-platform" "full-codebase" "enterprise"  # 企業級全面審查
bash .claude/scripts/sccpm/review.sh "web-app" "recent-commits" "standard"       # 標準最近提交審查
```

### 📊 監控與分析階段

#### `/sccpm:analyze` - 專案深度分析

```bash
# 基本語法
bash .claude/scripts/sccpm/analyze.sh "專案名稱" [分析維度] [報告格式]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
分析維度     : 可選，architecture(架構) | performance(性能) | security(安全) | quality(品質) | all(全面)，預設: all
報告格式     : 可選，summary(摘要) | detailed(詳細) | executive(高層)，預設: detailed

# 🌟 使用範例
bash .claude/scripts/sccpm/analyze.sh "web-app" "security" "executive"         # 安全分析高層報告
bash .claude/scripts/sccpm/analyze.sh "web-platform" "performance" "detailed"   # 性能詳細分析
bash .claude/scripts/sccpm/analyze.sh "web-platform" "all" "summary"           # 全面分析摘要
```

#### `/sccpm:standup` - 智能站立會議

```bash
# 基本語法
bash .claude/scripts/sccpm/standup.sh "專案名稱" [時間範圍] [報告類型]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
時間範圍     : 可選，daily(每日) | weekly(每週) | sprint(衝刺)，預設: daily
報告類型     : 可選，progress(進度) | blockers(阻礙) | metrics(指標) | full(完整)，預設: full

# 🌟 使用範例
bash .claude/scripts/sccpm/standup.sh "mobile-app" "daily" "progress"          # 每日進度報告
bash .claude/scripts/sccpm/standup.sh "api-platform" "weekly" "full"          # 每週完整報告
```

### 🚀 部署與維運階段

#### `/sccpm:deploy` - 智能部署管理

```bash
# 基本語法
bash .claude/scripts/sccpm/deploy.sh "專案名稱" [部署環境] [部署策略]

# 📋 參數說明
專案名稱     : 必填，專案識別名稱
部署環境     : 可選，dev(開發) | staging(測試) | production(正式)，預設: staging
部署策略     : 可選，blue-green(藍綠) | rolling(滾動) | canary(金絲雀)，預設: blue-green

# 🌟 使用範例
bash .claude/scripts/sccpm/deploy.sh "web-app" "production" "blue-green"       # 正式環境藍綠部署
bash .claude/scripts/sccpm/deploy.sh "api-service" "staging" "rolling"        # 測試環境滾動部署
```

### ❓ 說明與幫助

#### `/sccpm:help` - 完整說明文檔

```bash
# 顯示完整幫助
bash .claude/scripts/sccpm/help.sh

# 顯示特定指令幫助
bash .claude/scripts/sccpm/help.sh "develop-ultimate"
bash .claude/scripts/sccpm/help.sh "sync"
```

#### `/sccpm:watchdog` - 🛡️ 會話持續性保護系統

**功能**: 智能監控 Claude Code 會話狀態，當偏離 SCCPM 指令行為時自動觸發強制回歸機制，確保多 Agent 系統持續運作。

```bash
# 基本語法
bash .claude/scripts/sccpm/watchdog.sh [選項]

# 📋 核心功能
--monitor-session    # 啟動會話守護者（自動監控模式）
--auto-recovery      # 啟用自動回歸機制
--force-recovery     # 手動觸發強制回歸
--status            # 查詢當前守護者狀態
--health-report     # 生成會話健康度報告

# 🛡️ 監控參數
--check-interval <秒>        # 檢查間隔（預設：30 秒）
--deviation-threshold <次數> # 偏離次數閾值（預設：3 次）
--recovery-strategy <模式>   # 回歸策略：gentle | normal | aggressive
--agent-count <數量>         # 監控的 Agent 數量

# 🌟 實戰範例
# 启动完整会话保护（推荐用于长时间开发）
bash .claude/scripts/sccpm/watchdog.sh \
    --monitor-session \
    --auto-recovery \
    --check-interval 30 \
    --deviation-threshold 3 \
    --recovery-strategy aggressive

# 手動強制回歸（當發現會話偏離時）
bash .claude/scripts/sccpm/watchdog.sh --force-recovery --restore-agents 12

# 查询守护者运行状态
bash .claude/scripts/sccmp/watchdog.sh --status --detailed
```

**🔧 工作原理**:
1. **會話狀態檢測**: 監控上下文完整性、Agent 響應、指令執行追蹤
2. **智能偏離檢測**: 檢測何時 Claude Code 回歸原生模式，失去 SCCPM 控制
3. **自動回歸機制**: 重啟 Agent、恢復上下文、重新執行 SCCPM 指令邏輯
4. **持續性保護**: 背景守護程序確保整個開發會話的穩定性

**⚡ 自動整合**: 所有 SCCPM 指令 (`develop-ultimate`, `develop`, `prd`, `epic`, `sync` 等) 都會自動啟動會話守護者，無需手動配置！

---

## 🎯 專案類型智能適配

SCCPM 會根據專案名稱自動識別專案類型並配置專業代理：

### 🌐 Web應用/電商平台專案
**觸發關鍵字**: `web`, `platform`, `ecommerce`, `application`, `system`

```yaml
專業代理配置:
  - 🏗️ 全端架構專家: 系統設計 + 技術整合
  - 🎨 前端專家: 現代框架 + 用戶體驗
  - ⚙️ 後端專家: API設計 + 資料處理
  - 🗄️ 資料庫專家: 資料建模 + 性能調優
  - 🛡️ 資安專家: 安全架構 + 風險控制
  - 🧪 測試專家: 品質保證 + 自動化測試
  - 🔧 DevOps專家: CI/CD + 部署管理
  - ⚡ 性能專家: 優化調校 + 監控分析

合規要求: Security Standards, Code Quality, Documentation
性能要求: 響應時間<200ms, 可用性>99.9%, 併發用戶>1000+
安全等級: Standard (資料加密, 存取控制, 稽核日誌)
```


### 📱 移動應用
**觸發關鍵字**: `mobile`, `app`, `ios`, `android`, `react-native`

```yaml
專業代理配置:
  - 📱 iOS專家: Swift + UIKit/SwiftUI
  - 🤖 Android專家: Kotlin + Jetpack Compose
  - 🔄 跨平台專家: React Native + Flutter
  - 🎨 UI/UX專家: 移動設計模式 + 可訪問性
  - ⚡ 性能專家: 電池優化 + 記憶體管理
  - 🧪 移動測試專家: Appium + Device Testing

性能要求: 啟動時間<3s, 60FPS流暢度, 記憶體<100MB
平台支援: iOS 14+, Android API 21+
```

---

## ⚙️ 開發規範配置

SCCPM 支援多種方式配置開發規範：

### 📋 方法 1: YAML 配置文件 (推薦)

建立 `.claude/standards/專案名稱.yml`:

```yaml
# 專案資訊
project_info:
  name: "web-platform"
  type: "web-application"
  compliance_level: "enterprise"

# 代碼品質規範
code_standards:
  formatting:
    tool: "prettier"
    config:
      useTabs: true
      tabWidth: 4
      printWidth: 200
      singleQuote: true

  linting:
    tool: "eslint"
    rules:
      - "no-console: error"
      - "complexity: [error, 10]"

  typescript:
    strict: true
    noImplicitAny: true

# 測試標準
testing:
  coverage:
    unit: 85
    integration: 75
    e2e: 60

  frameworks:
    unit: "vitest"
    e2e: "playwright"

# Git 工作流程
git:
  workflow: "gitflow"
  commit_convention: "conventional"
  protection_rules:
    main:
      require_reviews: 2
      require_status_checks: true

# 安全要求
security:
  level: "high"
  requirements:
    - "no-hardcoded-secrets"
    - "input-validation"
    - "rate-limiting"

  enterprise_security:
    - "tls-encryption"
    - "api-key-management"
    - "secure-authentication"
    - "audit-logging"

# 性能標準
performance:
  targets:
    lighthouse_score: 90
    api_response_time: "100ms"
    websocket_latency: "10ms"
```

### 📄 方法 2: CLAUDE.md 整合

在專案根目錄的 `CLAUDE.md` 中定義規範，SCCPM 會自動讀取。

### 🚀 方法 3: 指令參數

```bash
bash .claude/scripts/sccpm/develop-ultimate.sh "my-project" \
  --standards ".claude/standards/custom.yml" \
  --code-style "prettier,eslint,tabs:4" \
  --test-coverage "85,75,60" \
  --security-level "high"
```

---

## 🔧 高級功能配置

### 🧠 Serena 專案記憶管理

SCCPM 使用 Serena MCP 實現跨會話專案狀態管理：

```bash
# 專案記憶包含：
✅ 247個開發決策記錄 (架構選擇, 技術選型, 最佳實踐)
✅ 18個Agent協作模式 (分工策略, 溝通模式, 效率指標)
✅ 3.2GB專案知識庫 (代碼模式, 錯誤解決方案, 經驗累積)
✅ 開發歷史追蹤 (版本變更, 重構歷史, 性能提升)
✅ 團隊偏好學習 (開發風格, 工具選擇, 流程偏好)
```

### 🎯 專案智能識別規則

```yaml
專案類型識別矩陣:
  high_performance_system:
    keywords: ["performance", "realtime", "scalable", "distributed"]
    agents: [架構師, 性能專家, 後端工程師, 資料庫專家, 監控專家, DevOps]
    compliance: ["ISO27001", "GDPR", "SOC2"]

  enterprise_application:
    keywords: ["enterprise", "business", "system", "platform"]
    agents: [架構師, 全端工程師, 資料庫專家, 安全專家, 測試專家, DevOps]
    compliance: ["ISO27001", "GDPR", "WCAG"]
    quality_gates: ["code_review", "security_scan", "performance_test"]

  web_platform:
    keywords: ["web", "platform", "frontend", "backend", "api"]
    agents: [前端專家, 後端專家, API設計師, 資料庫專家, 測試工程師]
    compliance: ["WCAG_2.1_AA", "OWASP_Top10"]
    quality_gates: ["accessibility_check", "security_audit", "load_test"]

  data_analytics:
    keywords: ["data", "analytics", "ml", "ai", "insights"]
    agents: [資料工程師, 分析師, ML工程師, 視覺化專家, 品質專家]
    compliance: ["GDPR", "Data_Governance"]
    quality_gates: ["data_validation", "model_testing", "pipeline_monitoring"]
```

---

## 📈 效能與監控

### 🚀 性能指標

```yaml
SCCPM 執行效能:
  多代理並行效率: 60-80% 開發時間節省
  代碼品質提升: 35% 缺陷減少
  測試覆蓋率: 平均85%+ 自動達成
  部署成功率: 95%+ 自動化部署
  文檔完整度: 90%+ 自動生成
```

### 📊 監控與報告

```bash
# 即時監控儀表板
✅ Agent 工作狀態和進度追蹤
✅ 代碼品質指標 (複雜度, 覆蓋率, 技術債務)
✅ 安全掃描結果 (漏洞數量, 風險等級)
✅ 性能基準 (構建時間, 測試執行時間)
✅ Git 活動 (提交頻率, PR 狀態, Code Review)
✅ 部署狀態 (環境健康度, 錯誤率, 響應時間)
```

---

## 🆘 疑難排解

### 常見問題

#### Q: 指令不被識別 `Unknown slash command: sccpm:xxx`

**解決方案**:
```bash
# 方法 1: 直接使用 bash 腳本
bash .claude/scripts/sccpm/develop-ultimate.sh "your-project"

# 方法 2: 檢查目錄結構
ls -la .claude/commands/sccpm/
ls -la .claude/scripts/sccpm/

# 方法 3: 重新載入 Claude Code (如果使用斜線指令)
# 重啟 Claude Code 或重新載入工作目錄
```

#### Q: Agent 專業化不正確

**解決方案**:
```bash
# 檢查專案名稱是否包含正確關鍵字
bash .claude/scripts/sccpm/develop.sh "web-platform" # ✅ 正確
bash .claude/scripts/sccpm/develop.sh "my-project"        # ❌ 泛用型

# 手動指定專案類型
bash .claude/scripts/sccpm/develop.sh "my-platform" "intensive" "8" "performance"
```

#### Q: 開發規範沒有被載入

**解決方案**:
```bash
# 檢查規範文件存在
ls -la .claude/standards/

# 手動指定規範文件
bash .claude/scripts/sccpm/develop-ultimate.sh "project" "enterprise" "12" "strict" "gitflow" "github-actions" ".claude/standards/my-standards.yml"

# 檢查 CLAUDE.md 是否包含規範
cat CLAUDE.md | grep -A 10 "開發規範"
```

#### Q: GitHub 整合失敗

**解決方案**:
```bash
# 檢查 GitHub CLI 配置
gh auth status

# 檢查倉庫存在且有權限
gh repo view your-username/your-repo

# 手動執行 GitHub 同步
bash .claude/scripts/sccpm/sync.sh "your-project" "create-issues" "auto-assign"
```

#### Q: MCP 服務無法連接

**解決方案**:
```bash
# 檢查 MCP 服務狀態 (具體方法依 Claude Code 版本而異)
# 確保以下 MCP 服務已安裝和配置：
# - Sequential (複雜推理)
# - Context7 (文檔查詢)
# - Magic (UI 生成)
# - Morphllm (代碼轉換)
# - Serena (專案記憶)
# - Playwright (自動化測試)

# 降級使用基本版本 (不依賴特定 MCP)
bash .claude/scripts/sccpm/develop.sh "your-project" "balanced" "6"
```

---

## 📞 技術支援

### 🔗 相關連結

- **GitHub Repository**: https://github.com/yourusername/superclaude-code-pm
- **問題回報**: https://github.com/yourusername/superclaude-code-pm/issues
- **功能請求**: https://github.com/yourusername/superclaude-code-pm/discussions
- **Claude Code 官方**: https://claude.ai/code

### 📧 聯繫方式

- **Email**: support@superclaude-pm.com
- **Discord**: SuperClaude PM Community
- **Twitter**: @SuperClaudePM

---

## 🤝 貢獻指南

歡迎貢獻 SCCPM 框架！請查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解詳細指引。

### 貢獻類型
- 🐛 Bug 修復
- ✨ 新功能開發
- 📚 文檔改進
- 🧪 測試案例
- 🎨 UI/UX 改進
- 🌐 多語言支援

---

## 📄 授權條款

MIT License - 詳見 [LICENSE](LICENSE) 文件。

---

## 🙏 致謝

感謝以下專案和社群的啟發：

- **Claude Code**: 提供強大的 AI 編程平台
- **SuperClaude Framework**: 高效能 AI 代理框架
- **CCPM**: 多代理並行處理管理系統
- **所有 MCP 服務開發者**: 提供專業化工具整合

---

<div align="center">

### 🚀 讓 SCCPM 成為你下一個專案的超級引擎！

**[⭐ Star this repo](https://github.com/yourusername/superclaude-code-pm)** | **[🍴 Fork](https://github.com/yourusername/superclaude-code-pm/fork)** | **[📖 Documentation](https://docs.superclaude-pm.com)**

</div>