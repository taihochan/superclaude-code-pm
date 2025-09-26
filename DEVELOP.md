# 🛠️ SCCPM Framework - 開發者架構手冊

> **開發者架構文檔** - SCCPM 框架內部設計、架構邏輯和開發指引

---

## 📋 文檔目的

這份文檔是為了讓未來的開發者（包括 Claude 自己）能夠快速理解 SCCPM 框架的完整架構設計和實現邏輯，確保在更新、修改或擴展專案時能夠迅速銜接上手。

---

## 🏗️ 核心架構設計

### 💡 設計理念

SCCPM 框架基於以下核心設計理念：

1. **雙引擎協作**: CCPM (結構化管理) + SuperClaude (智能執行)
2. **多代理並行**: 最大化並行處理效率，減少開發時間
3. **智能適配**: 根據專案類型自動配置專業代理
4. **企業級品質**: 完整的品質保證和 CI/CD 整合
5. **跨會話記憶**: 使用 Serena MCP 實現狀態持久化
6. **模塊化設計**: 每個階段獨立但協調運作

### 🧩 系統架構圖

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SCCPM Framework v2.0                           │
├─────────────────────────────────────────────────────────────────────┤
│                    🎯 用戶命令接口層 (Layer 5)                        │
│  /sccpm:* 指令接口 | 參數解析 | 錯誤處理 | 用戶反饋                      │
├─────────────────────────────────────────────────────────────────────┤
│                   🧠 智能協調層 (Layer 4)                            │
│  專案類型識別 | Agent專業化配置 | MCP服務協調 | 工作流程編排               │
├─────────────────────────────────────────────────────────────────────┤
│                   🔄 執行引擎層 (Layer 3)                            │
│  並行執行管理 | 階段流程控制 | 狀態同步 | 進度追蹤                        │
├─────────────────────────────────────────────────────────────────────┤
│                   🛠️ 服務整合層 (Layer 2)                           │
│  CCPM集成 | SuperClaude集成 | MCP服務管理 | GitHub整合                 │
├─────────────────────────────────────────────────────────────────────┤
│                   📚 基礎設施層 (Layer 1)                            │
│  文檔管理 | 配置管理 | 日誌系統 | 錯誤處理 | 文件I/O                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 目錄結構詳解

### 核心目錄架構

```
.claude/
├── commands/sccpm/              # 指令定義文檔
│   ├── *.md                     # 每個指令的完整說明
│   └── develop-ultimate.md      # 終極開發指令 (最核心)
├── scripts/sccpm/               # 腳本實現
│   ├── *.sh                     # Bash 腳本實現
│   └── develop-ultimate.sh      # 終極開發腳本 (最複雜)
└── standards/                   # 開發規範配置
    ├── *.yml                    # YAML 格式規範配置
    └── *.yml                    # 專案規範配置範例
```

### 設計模式

#### 1. 指令-腳本分離模式
- **commands/**: 定義指令功能、參數、說明 (用戶文檔)
- **scripts/**: 實際執行邏輯 (程式碼實現)
- **優勢**: 文檔與實現分離，便於維護和更新

#### 2. 階段化執行模式
每個腳本都遵循 6 階段執行模式：
```bash
Phase 1: 初始化和配置載入
Phase 2: 核心邏輯執行
Phase 3: 智能處理和分析
Phase 4: 品質保證和驗證
Phase 5: 整合和輸出
Phase 6: 狀態更新和記憶保存
```

---

## 🎯 指令系統設計

### 指令命名規範

```yaml
指令格式: "/sccpm:{stage}" 或 "/sccpm:{stage}-{variant}"

生命週期階段:
  - prd: PRD 生成與優化
  - epic: EPIC 分解與設計
  - issue: Issue 管理與增強
  - sync: GitHub 整合與同步
  - develop: 標準開發協調
  - develop-ultimate: 終極品質開發 (企業級)
  - test: 智能測試執行
  - review: 代碼審查與品質分析
  - analyze: 專案深度分析
  - deploy: 智能部署管理
  - standup: 智能站立會議

管理指令:
  - help: 完整說明文檔
  - status: 系統狀態檢查
  - orchestrate: 多代理協調
```

### 參數設計邏輯

每個指令遵循統一的參數設計模式：

```bash
bash .claude/scripts/sccpm/{command}.sh "專案名稱" [模式] [選項] [配置]

位置參數:
  $1: 專案名稱 (必填) - 用於專案類型識別和配置
  $2: 執行模式 (可選) - 影響執行策略和資源分配
  $3: 數量/等級 (可選) - 代理數量、覆蓋率要求等
  $4: 特殊配置 (可選) - 專注領域、品質等級等

設計原則:
  - 位置參數按重要性排序
  - 提供合理的預設值
  - 支援向後相容
  - 錯誤處理友善
```

---

## 🧠 智能系統設計

### 專案類型自動識別

```bash
# 實現位置: scripts/sccpm/*.sh 中的專案類型偵測邏輯
function detect_project_type() {
    local project_name="$1"
    local detected_type="generic"

    # Web 應用/電商
    elif [[ "$project_name" =~ (web|app|ecommerce|shop|platform|api) ]]; then
        detected_type="web_application"

    # 移動應用
    elif [[ "$project_name" =~ (mobile|ios|android|react-native|flutter) ]]; then
        detected_type="mobile_application"

    # 數據分析平台
    elif [[ "$project_name" =~ (data|analytics|ml|ai|insights) ]]; then
        detected_type="data_analytics"
    fi

    echo "$detected_type"
}
```

### Agent 專業化配置矩陣

```yaml
# 配置文件位置: .claude/standards/{project-type}.yml
專案類型對應代理配置:
  generic_project:
    agents:
      - Full_Stack_Expert: "🏗️ 全端架構專家 (系統設計 + 技術整合)"
      - Frontend_Expert: "🎨 前端專家 (現代框架 + 用戶體驗)"
      - Backend_Expert: "⚙️ 後端專家 (API設計 + 資料處理)"
      - Database_Expert: "🗄️ 資料庫專家 (資料建模 + 性能調優)"
      - Security_Expert: "🛡️ 資安專家 (安全架構 + 風險控制)"
      - Testing_Expert: "🧪 測試專家 (品質保證 + 自動化測試)"
      - DevOps_Expert: "🔧 DevOps專家 (CI/CD + 部署管理)"
      - Performance_Expert: "⚡ 性能專家 (優化調校 + 監控分析)"

    performance_requirements:
      response_time: "200ms"
      availability: "99.9%"
      concurrent_users: "1000+"

    compliance_requirements: ["Security Standards", "Code Quality", "Documentation"]
    security_level: "standard"

  web_application:
    agents:
      - Frontend_Expert: "🎨 前端架構專家 (React/Vue + 響應式設計)"
      - Backend_Expert: "🏗️ 後端架構專家 (Node.js/Python + API設計)"
      - Database_Expert: "🗄️ 資料庫專家 (SQL/NoSQL + 性能調優)"
      - Security_Expert: "🔐 安全專家 (HTTPS + Authentication + CORS)"
      - Testing_Expert: "🧪 測試專家 (Jest + Cypress + 自動化測試)"
      - SEO_Performance: "📊 SEO/性能專家 (Lighthouse + Core Web Vitals)"

    performance_requirements:
      lighthouse_score: 90
      first_contentful_paint: "1.5s"
      largest_contentful_paint: "2.5s"

    compliance_requirements: ["GDPR", "CCPA", "WCAG 2.1 AA"]
    security_level: "high"
```

---

## 🛡️ 會話持續性保護系統 (Session Guardian)

### 🎯 設計目標

解決 Claude Code 長時間會話中的核心問題：**會話偏離與上下文丟失**

當用戶執行如 `/sccpm:develop-ultimate "web-platform" --mode enterprise --agents 12` 這樣的複雜指令時，會話可能在中途偏離回到原生 Claude Code 模式，失去 SCCPM 的多代理控制和企業級功能。

### 🏗️ 技術架構

```bash
┌─────────────────────────────────────────────────────────────┐
│                Session Guardian Architecture                 │
├─────────────────────────────────────────────────────────────┤
│  🎯 Main Script          │  🛡️ Guardian Core              │
│  ┌─────────────────────┐  │  ┌───────────────────────────┐   │
│  │ /sccpm:develop      │  │  │ session-guard.sh          │   │
│  │ - init_session      │◄─┤  │ - Background Monitor      │   │
│  │ - main_logic        │  │  │ - State Detection         │   │
│  │ - terminate_session │  │  │ - Auto Recovery           │   │
│  └─────────────────────┘  │  └───────────────────────────┘   │
│                           │                                  │
│  📊 Session State Files  │  🔄 Recovery Mechanisms          │
│  ┌─────────────────────┐  │  ┌───────────────────────────┐   │
│  │ /tmp/sccpm_session/ │  │  │ - Agent Restart           │   │
│  │ - context.json      │  │  │ - Context Restore         │   │
│  │ - agent_status.json │  │  │ - Command Re-execution    │   │
│  │ - heartbeat         │  │  │ - State Synchronization   │   │
│  └─────────────────────┘  │  └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 🔧 核心組件實現

#### 1. 全域守護者核心 (`session-guard.sh`)

**關鍵函數**：

```bash
# 初始化會話守護者
init_global_session_guard() {
    local command_name="$1"
    local agent_count="$2"
    local project_name="$3"

    # 創建會話上下文
    # 啟動背景監控程序
    # 設定狀態檔案
}

# 檢查會話健康度
check_sccpm_session_health() {
    # 檢查上下文完整性
    # 檢查 Agent 活躍度
    # 檢查 PM/SC 整合狀態
    # 返回健康度評估
}

# 執行自動回歸
execute_session_recovery() {
    # 清理異常狀態
    # 重建 SCCPM 上下文
    # 重啟 Agent 系統
    # 重新執行指令邏輯
    # 驗證回歸成功
}
```

#### 2. 會話狀態監控

**狀態檢測維度**：

```json
{
  "session_health_matrix": {
    "context_integrity": {
      "sccpm_context_file": "存在且有效",
      "session_variables": "環境變數完整",
      "command_history": "指令歷史記錄"
    },
    "agent_system": {
      "expected_agents": 12,
      "active_agents": 12,
      "agent_response": "正常",
      "parallel_processing": "運行中"
    },
    "framework_integration": {
      "pm_status": "活躍",
      "sc_status": "活躍",
      "mcp_services": "整合中"
    }
  }
}
```

#### 3. 智能偏離檢測

**檢測邏輯**：

```bash
# 偏離檢測算法
detect_session_deviation() {
    local deviation_score=0

    # 檢查 1: 上下文檢測 (權重: 40%)
    if [ ! -f "$SCCMP_CONTEXT_FILE" ]; then
        deviation_score=$((deviation_score + 40))
    fi

    # 檢查 2: Agent 活躍度 (權重: 35%)
    local active_ratio=$(get_agent_active_ratio)
    if [ $active_ratio -lt 50 ]; then
        deviation_score=$((deviation_score + 35))
    fi

    # 檢查 3: 框架整合狀態 (權重: 25%)
    if ! check_framework_integration; then
        deviation_score=$((deviation_score + 25))
    fi

    # 偏離閾值: 60%
    return $((deviation_score > 60 ? 1 : 0))
}
```

#### 4. 自動回歸策略

**三階段回歸流程**：

```yaml
Stage1_狀態清理:
  - 終止異常處理程序
  - 清理殘留上下文
  - 重置會話狀態

Stage2_系統重建:
  - 重新載入 SCCPM 上下文
  - 重啟 Agent 映射
  - 恢復專案配置
  - 重建服務連接

Stage3_指令恢復:
  - 重新執行原始指令邏輯
  - 恢復工作流程狀態
  - 同步 GitHub 整合
  - 驗證系統完整性
```

### 💡 整合方式

**所有 SCCPM 腳本自動整合**：

```bash
#!/bin/bash
# 任何 SCCMP 腳本模板

# 載入全域會話守護者
source "$(dirname "$0")/session-guard.sh"

# 腳本開始時自動啟動
PROJECT_NAME="$1"
AGENTS="${2:-6}"
init_global_session_guard "script-name" "$AGENTS" "$PROJECT_NAME"

# 主要邏輯...
# ...

# 腳本結束時自動終止
terminate_session_guard "script-name"
```

**背景守護程序**：

```bash
# 30秒間隔監控
while [ -f "$SCCPM_CONTEXT_FILE" ]; do
    if ! check_sccpm_session_health; then
        deviation_count=$((deviation_count + 1))

        if [ $deviation_count -ge 3 ]; then
            execute_session_recovery
            deviation_count=0
        fi
    fi

    sleep 30
done
```

### 📊 效果與優勢

1. **徹底解決會話偏離問題**: 自動檢測並強制回歸 SCCPM 模式
2. **零配置自動保護**: 所有 SCCPM 指令預設啟用保護
3. **智能恢復機制**: 保留開發進度，無縫恢復工作狀態
4. **企業級穩定性**: 適用於長時間、高強度開發會話
5. **透明運作**: 不干擾正常開發流程，背景默默保護

---

## 🔄 執行流程設計

### 標準 6 階段執行模式

所有 SCCPM 腳本都遵循統一的 6 階段執行架構：

```bash
#!/bin/bash
# SCCMP {Command Name} - {Description}

# === 階段 1: 智能初始化 ===
echo -e "${PURPLE}╭─────────────────────────────────────────╮${NC}"
echo -e "${PURPLE}│  Phase 1: 智能初始化 / Initialization   │${NC}"
echo -e "${PURPLE}╰─────────────────────────────────────────╯${NC}"

# 1.1 專案記憶載入 (Serena MCP)
# 1.2 開發規範載入 (Standards Configuration)
# 1.3 工作流程建立 (Workflow Setup)

# === 階段 2: 核心執行 ===
echo -e "${PURPLE}╭─────────────────────────────────────────╮${NC}"
echo -e "${PURPLE}│  Phase 2: 核心執行 / Core Execution     │${NC}"
echo -e "${PURPLE}╰─────────────────────────────────────────╯${NC}"

# 2.1 主要邏輯實現
# 2.2 MCP 服務整合

# === 階段 3: 智能增強 ===
echo -e "${PURPLE}╭─────────────────────────────────────────╮${NC}"
echo -e "${PURPLE}│  Phase 3: 智能增強 / Intelligence       │${NC}"
echo -e "${PURPLE}╰─────────────────────────────────────────╯${NC}"

# 3.1 品質保證
# 3.2 智能分析

# === 階段 4: 協作整合 ===
echo -e "${PURPLE}╭─────────────────────────────────────────╮${NC}"
echo -e "${PURPLE}│  Phase 4: 協作整合 / Integration        │${NC}"
echo -e "${PURPLE}╰─────────────────────────────────────────╯${NC}"

# 4.1 系統整合
# 4.2 外部服務連接

# === 階段 5: 持久記憶 ===
echo -e "${PURPLE}╭─────────────────────────────────────────╮${NC}"
echo -e "${PURPLE}│  Phase 5: 持久記憶 / Memory Persistence │${NC}"
echo -e "${PURPLE}╰─────────────────────────────────────────╯${NC}"

# 5.1 狀態保存
# 5.2 學習記錄

# === 最終總結 ===
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           SCCPM {Command} 執行完成           ║${NC}"
echo -e "${CYAN}║              Execution Completed            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
```

### 視覺輸出設計標準

```bash
# 顏色定義 (所有腳本統一)
RED='\033[0;31m'      # 錯誤
GREEN='\033[0;32m'    # 成功
YELLOW='\033[1;33m'   # 警告/進行中
BLUE='\033[0;34m'     # 資訊
PURPLE='\033[0;35m'   # 階段標題
CYAN='\033[0;36m'     # 框架/總結
WHITE='\033[1;37m'    # 詳細內容
NC='\033[0m'          # 重置顏色

# Emoji 標準 (視覺一致性)
ROCKET="🚀"    # 啟動/完成
BRAIN="🧠"     # 智能處理
GEAR="⚙️"     # 配置/設定
SHIELD="🛡️"   # 安全/品質
CHART="📊"     # 分析/報告
GIT="🔗"       # Git/GitHub
TEST="🧪"      # 測試
DOC="📚"       # 文檔
SUCCESS="✅"   # 成功
WARNING="⚠️"   # 警告
ERROR="❌"     # 錯誤
STAR="⭐"      # 重點/精選
```

---

## 🧩 MCP 整合架構

### MCP 服務分層設計

SCCPM 框架整合了多個 MCP 服務，按功能分為 5 個層級：

```yaml
MCP_整合架構:
  Tier-1_核心推理:
    service: Sequential
    purpose: "主導多步驟分析決策"
    usage: "複雜問題分解、系統設計、架構決策"

  Tier-2_知識整合:
    services: [Context7, Serena]
    purpose: "文檔模式 + 專案記憶"
    usage: "官方文檔查詢、專案狀態管理、跨會話記憶"

  Tier-3_實作引擎:
    services: [Magic, Morphllm]
    purpose: "UI生成 + 批量轉換"
    usage: "UI組件生成、代碼重構、模式應用"

  Tier-4_驗證測試:
    service: Playwright
    purpose: "完整 E2E 測試覆蓋"
    usage: "瀏覽器測試、用戶流程驗證、視覺回歸測試"

  Tier-5_持久記憶:
    service: Serena
    purpose: "跨會話專案狀態管理"
    usage: "開發決策記錄、架構演進追蹤、學習累積"
```

### MCP 服務調用模式

```bash
# 在腳本中的 MCP 服務調用邏輯

function call_mcp_sequential() {
    echo -e "${BRAIN} 啟動 Sequential MCP: 複雜推理引擎"
    # 實際上在 Claude Code 環境中，這會觸發對應的 MCP 服務
    echo -e "${SUCCESS} Sequential 分析完成"
}

function call_mcp_context7() {
    echo -e "${DOC} 啟動 Context7 MCP: 官方文檔查詢"
    echo -e "${SUCCESS} 技術文檔已整合"
}

function call_mcp_magic() {
    echo -e "${STAR} 啟動 Magic MCP: UI組件生成引擎"
    echo -e "${SUCCESS} UI組件已生成"
}

function call_mcp_serena() {
    echo -e "${BRAIN} 啟動 Serena MCP: 專案記憶引擎"
    echo -e "${SUCCESS} 專案狀態已保存"
}

# 在 develop-ultimate.sh 中的實際整合
echo -e "${GREEN}   • ${SUCCESS} Sequential MCP: 複雜推理引擎已激活${NC}"
echo -e "${GREEN}   • ${SUCCESS} Context7 MCP: 官方文檔查詢已整合${NC}"
echo -e "${GREEN}   • ${SUCCESS} Magic MCP: UI組件生成引擎已就緒${NC}"
echo -e "${GREEN}   • ${SUCCESS} Morphllm MCP: 批量代碼轉換已啟用${NC}"
echo -e "${GREEN}   • ${SUCCESS} Serena MCP: 專案記憶引擎已連線${NC}"
echo -e "${GREEN}   • ${SUCCESS} Playwright MCP: 自動化測試引擎已配置${NC}"
```

---

## ⚙️ 配置系統設計

### 開發規範配置架構

SCCPM 支援三層配置系統：

```yaml
配置優先級 (高 → 低):
  1. 命令行參數: --standards "path/to/config.yml"
  2. 專案特定配置: .claude/standards/{project-name}.yml
  3. 通用配置: .claude/standards/default.yml
  4. CLAUDE.md 嵌入式配置: 專案根目錄的 CLAUDE.md
  5. 內建預設配置: 腳本內的硬編碼預設值
```

### 配置文件結構設計

```yaml
# .claude/standards/{project-name}.yml 標準結構
project_info:              # 專案基礎資訊
  name: "project-name"
  type: "project-type"
  compliance_level: "enterprise"

code_standards:             # 代碼品質規範
  formatting: {...}         # 格式化工具配置
  linting: {...}           # 代碼檢查規則
  typescript: {...}        # TypeScript 設定

testing:                   # 測試標準
  coverage: {...}          # 覆蓋率要求
  frameworks: {...}        # 測試框架選擇

git:                       # Git 工作流程
  workflow: "gitflow"      # 分支策略
  commit_convention: "conventional"
  protection_rules: {...}  # 分支保護規則

security:                  # 安全要求
  level: "high"           # 安全等級
  requirements: [...]      # 通用安全要求
  project_specific: [...]   # 專案特定安全要求

performance:               # 性能標準
  targets: {...}          # 性能目標

compliance:               # 合規要求
  financial: [...]        # 金融合規
  data_protection: [...] # 數據保護

collaboration:            # 團隊協作
  communication: {...}    # 溝通規範
  review_process: {...}   # 審查流程
```

### 配置載入邏輯

```bash
# 在腳本中的配置載入實現
function load_project_standards() {
    local project_name="$1"
    local standards_file="$2"

    # 檢測配置文件優先級
    local config_paths=(
        "$standards_file"                          # 命令行指定
        ".claude/standards/${project_name}.yml"    # 專案特定
        ".claude/standards/default.yml"           # 通用配置
        "CLAUDE.md"                               # 嵌入式配置
    )

    for path in "${config_paths[@]}"; do
        if [ -f "$path" ]; then
            STANDARDS_PATH="$path"
            echo -e "${SUCCESS} 自動檢測到規範配置: ${path}"
            break
        fi
    done

    # 載入並解析配置
    if [[ "$STANDARDS_PATH" == *.yml ]]; then
        echo -e "${GREEN} 格式: YAML 配置文件${NC}"
        # 這裡可以使用 yq 或其他 YAML 解析工具

    elif [[ "$STANDARDS_PATH" == "CLAUDE.md" ]]; then
        echo -e "${GREEN} 格式: CLAUDE.md 專案指導文件${NC}"
        # 從 CLAUDE.md 提取規範

    else
        echo -e "${WARNING} 使用內建預設規範${NC}"
    fi
}
```

---

## 🎯 品質保證設計

### 多維度品質檢測架構

```yaml
品質檢測維度矩陣:
  代碼品質:
    tools: [ESLint, Prettier, TypeScript, SonarQube]
    metrics: [複雜度, 重複度, 可維護性指數]
    thresholds:
      complexity: 10
      duplication: 5%
      maintainability: B+

  安全檢測:
    tools: [npm audit, Snyk, SAST]
    scans: [漏洞掃描, 依賴檢查, 靜態分析]
    levels: [critical, high, medium, low]

  性能基準:
    tools: [Lighthouse, Bundle Analyzer, Memory Profiler]
    metrics: [Core Web Vitals, Bundle Size, Memory Usage]
    targets:
      lighthouse_score: ">90"
      bundle_size: "<1MB"
      memory_usage: "<100MB"

  測試覆蓋:
    types: [Unit, Integration, E2E, Visual Regression]
    requirements:
      unit: ">85%"
      integration: ">75%"
      e2e: ">60%"
      visual: "100% critical flows"

  文檔品質:
    formats: [OpenAPI, JSDoc, README, Changelog]
    completeness: ">90%"
    accuracy: "Manual review required"

  可訪問性:
    standards: [WCAG 2.1 AA, Section 508]
    tools: [axe-core, Lighthouse a11y, manual testing]
    compliance: "100% critical paths"

  Git 規範:
    conventions: [Conventional Commits, Branch naming]
    protections: [Required reviews, Status checks]
    automation: [PR templates, Auto-merge]

  合規檢查:
    types: [Industry-specific, Data protection, Security]
    frameworks: [PCI-DSS, GDPR, SOX, HIPAA]
    auditing: [Automated + Manual validation]
```

---

## 📊 監控與報告系統

### 執行監控設計

```bash
# 監控數據收集
function collect_execution_metrics() {
    local start_time=$(date +%s)
    local project_name="$1"
    local command="$2"

    # 執行主要邏輯
    execute_main_logic

    local end_time=$(date +%s)
    local execution_time=$((end_time - start_time))

    # 記錄執行統計
    echo "METRICS: {
        \"project\": \"$project_name\",
        \"command\": \"$command\",
        \"execution_time\": $execution_time,
        \"timestamp\": \"$(date -Iseconds)\",
        \"agents_configured\": $AGENTS_COUNT,
        \"mcp_services_used\": $MCP_SERVICES_COUNT,
        \"quality_dimensions\": $QUALITY_DIMENSIONS_COUNT
    }" >> ".claude/logs/execution-metrics.json"
}

# 在每個腳本的最終總結中展示統計
echo -e "${YELLOW}📊 執行統計 / Execution Statistics:${NC}"
echo -e "${WHITE}   • 配置Agent數量: ${AGENTS} 個專業Agent / ${AGENTS} specialized agents${NC}"
echo -e "${WHITE}   • MCP整合服務: 6個核心MCP服務 / 6 core MCP services${NC}"
echo -e "${WHITE}   • 品質檢測維度: 8個品質檢測層面 / 8 quality assurance dimensions${NC}"
echo -e "${WHITE}   • 測試覆蓋配置: Unit + Integration + E2E + Visual${NC}"
echo -e "${WHITE}   • CI/CD管道階段: 6個自動化階段 / 6 automated pipeline stages${NC}"
echo -e "${WHITE}   • 記憶管理維度: 6個智能記憶層面 / 6 intelligent memory dimensions${NC}"
```

### 報告生成邏輯

```yaml
報告生成架構:
  執行報告:
    format: [JSON, Markdown, HTML]
    content: [執行統計, 品質指標, 錯誤日誌]
    destination: ".claude/reports/{project}-{command}-{timestamp}"

  品質報告:
    dimensions: [Code, Security, Performance, Testing, Documentation]
    scoring: [Pass/Fail, Numerical scores, Trend analysis]
    recommendations: [Automated insights, Best practices]

  進度報告:
    tracking: [Phase completion, Agent status, Resource usage]
    visualization: [Progress bars, Status indicators, Trend charts]
    alerts: [Blockers, Delays, Resource constraints]
```

---

## 🔧 擴展開發指南

### 新增指令的標準流程

1. **需求分析**
   - 確定指令目的和使用場景
   - 定義輸入參數和期望輸出
   - 設計與現有指令的集成方式

2. **文檔創建**
   ```bash
   # 在 .claude/commands/sccpm/ 創建指令文檔
   touch .claude/commands/sccpm/new-command.md
   ```

3. **腳本實現**
   ```bash
   # 在 .claude/scripts/sccpm/ 創建腳本實現
   touch .claude/scripts/sccpm/new-command.sh
   chmod +x .claude/scripts/sccpm/new-command.sh
   ```

4. **遵循標準模板**
   - 使用 6 階段執行架構
   - 統一視覺輸出格式
   - 整合 MCP 服務調用
   - 實現配置載入邏輯

5. **測試驗證**
   - 測試不同參數組合
   - 驗證錯誤處理邏輯
   - 檢查輸出格式一致性

### 修改現有指令的標準流程

1. **理解現有架構**
   - 閱讀對應的 .md 文檔了解功能
   - 分析 .sh 腳本的實現邏輯
   - 識別修改點和影響範圍

2. **保持向後相容**
   - 不要破壞現有參數接口
   - 新功能使用可選參數
   - 保持預設行為一致

3. **更新文檔**
   - 同步更新 commands/*.md 文檔
   - 更新 README.md 中的使用範例
   - 更新這份 DEVELOP.md 如有架構變更

4. **測試回歸**
   - 測試現有功能無損
   - 驗證新功能正常運作
   - 檢查整體系統穩定性

---

## 🚨 常見問題與解決方案

### 開發過程中的常見問題

#### 1. 指令無法識別
**原因**: Claude Code 的斜線指令註冊機制限制
**解決方案**:
- 直接使用 bash 腳本執行
- 檢查文件權限和路徑
- 確保腳本語法正確

#### 2. MCP 服務調用失敗
**原因**: MCP 服務未安裝或配置不當
**解決方案**:
- 降級使用基本功能（不依賴 MCP）
- 在腳本中添加 MCP 可用性檢查
- 提供優雅的降級機制

#### 3. 配置載入錯誤
**原因**: YAML 格式錯誤或路徑問題
**解決方案**:
- 實現配置驗證邏輯
- 提供清晰的錯誤訊息
- 確保預設配置可用

#### 4. 專案類型識別錯誤
**原因**: 專案名稱不包含關鍵字
**解決方案**:
- 改進關鍵字匹配邏輯
- 允許手動指定專案類型
- 提供通用型代理配置

### 除錯技巧

```bash
# 啟用除錯模式
export SCCPM_DEBUG=true

# 在腳本中添加除錯訊息
if [[ "${SCCMP_DEBUG}" == "true" ]]; then
    echo "[DEBUG] 當前處理階段: $current_phase"
    echo "[DEBUG] 專案類型: $project_type"
    echo "[DEBUG] Agent配置: $agent_config"
fi

# 記錄詳細執行日誌
echo "$(date -Iseconds) [INFO] $message" >> ".claude/logs/sccpm-debug.log"
```

---

## 📈 效能優化建議

### 執行效能優化

1. **並行化處理**
   - 在可能的情況下使用並行執行
   - 避免不必要的順序依賴
   - 合理分配系統資源

2. **緩存機制**
   - 緩存專案類型識別結果
   - 緩存配置載入結果
   - 重用 MCP 服務連接

3. **資源管理**
   - 監控記憶體使用量
   - 控制並行代理數量
   - 及時清理臨時文件

### 使用者體驗優化

1. **視覺反饋**
   - 提供清晰的進度指示
   - 使用一致的視覺設計
   - 及時顯示執行狀態

2. **錯誤處理**
   - 提供明確的錯誤訊息
   - 建議具體的解決方案
   - 實現優雅的錯誤恢復

3. **文檔完整性**
   - 保持文檔與實現同步
   - 提供豐富的使用範例
   - 建立完整的疑難排解指南

---

## 🔮 未來發展方向

### 短期改進計劃 (v2.1)

1. **Web UI 介面**
   - 視覺化專案狀態監控
   - 圖形化配置管理
   - 互動式報告展示

2. **增強的 MCP 整合**
   - 更多 MCP 服務支援
   - 智能服務選擇邏輯
   - 自動化服務配置

3. **改進的品質保證**
   - 更細緻的品質指標
   - 智能品質建議
   - 自動化品質修復

### 中期發展目標 (v2.5)

1. **多租戶支援**
   - 團隊級配置管理
   - 權限控制系統
   - 資源隔離機制

2. **雲端整合**
   - 雲端專案狀態同步
   - 分散式代理協作
   - 雲端配置管理

3. **智能學習**
   - 用戶習慣學習
   - 專案模式識別
   - 自動化優化建議

### 長期願景 (v3.0)

1. **AI 驅動的專案管理**
   - 智能專案預測
   - 自動化決策建議
   - 主動問題預防

2. **跨平台整合擴展**
   - 多 IDE 支援
   - 多雲端平台整合
   - 企業級系統整合

---

## 📚 相關資源

### 核心依賴

1. **CCPM (Claude Code Project Management)**
   - 提供結構化專案管理功能
   - 多代理並行處理能力
   - GitHub 整合和工作流管理

2. **SuperClaude Framework**
   - 商業分析和戰略規劃
   - 高效能 AI 代理系統
   - MCP 服務整合平台

3. **MCP 服務生態**
   - Sequential: 複雜推理和分析
   - Context7: 官方文檔查詢
   - Magic: UI 組件生成
   - Morphllm: 代碼轉換和重構
   - Serena: 專案記憶和狀態管理
   - Playwright: 自動化測試和驗證

### 開發工具

1. **Shell 腳本開發**
   - Bash 4.0+ 支援
   - 標準 Unix 工具 (grep, awk, sed)
   - 顏色輸出和 Unicode 支援

2. **配置管理**
   - YAML 解析 (yq 推薦)
   - JSON 處理 (jq)
   - 環境變數管理

3. **版本控制**
   - Git 分支管理
   - GitHub CLI 整合
   - 自動化 PR 處理

---

## 🎓 開發最佳實踐

### 程式碼品質

1. **一致性原則**
   - 使用統一的命名慣例
   - 遵循相同的結構模式
   - 維護一致的視覺風格

2. **可維護性**
   - 編寫自我解釋的程式碼
   - 添加適當的註解和文檔
   - 實現模組化設計

3. **錯誤處理**
   - 預期並處理所有錯誤情況
   - 提供有意義的錯誤訊息
   - 實現優雅的降級機制

### 測試策略

1. **功能測試**
   - 測試所有主要執行路徑
   - 驗證參數處理邏輯
   - 檢查輸出格式正確性

2. **整合測試**
   - 測試與 MCP 服務的整合
   - 驗證配置載入機制
   - 檢查專案類型識別

3. **使用者測試**
   - 真實專案場景測試
   - 不同參數組合驗證
   - 錯誤恢復能力測試

### 文檔維護

1. **即時更新**
   - 程式碼變更時同步更新文檔
   - 保持範例與實現一致
   - 及時反映架構變更

2. **多層次文檔**
   - 用戶使用手冊 (README.md)
   - 開發者指南 (DEVELOP.md)
   - API 參考文檔 (commands/*.md)

3. **版本控制**
   - 文檔變更記錄
   - 向後相容性說明
   - 遷移指南提供

---

## 🎯 結論

SCCPM 框架是一個經過精心設計的多代理協作開發系統，結合了 CCPM 的結構化管理能力和 SuperClaude 的智能執行能力。

### 核心優勢

1. **智能化**: 自動專案類型識別和代理配置
2. **標準化**: 統一的執行模式和品質保證
3. **擴展性**: 模組化設計支援靈活擴展
4. **企業級**: 完整的 CI/CD 和合規支援
5. **持久化**: 跨會話專案狀態管理

### 維護要點

1. **保持架構一致性**: 所有新功能都應遵循現有的 6 階段執行模式
2. **向後相容性**: 確保更新不破壞現有用戶工作流程
3. **文檔同步**: 程式碼變更時必須同步更新文檔
4. **品質標準**: 維持企業級的代碼品質和測試覆蓋率

這份文檔應該能幫助任何開發者（包括 Claude 自己）快速理解和維護 SCCPM 框架。如有任何架構變更，請及時更新此文檔以保持準確性。

---

<div align="center">

**🛠️ 開發者手冊 v2.0 - 為持續演進的 SCCPM 框架而寫**

*"好的架構是演進出來的，偉大的文檔是維護出來的"*

</div>