# /sccpm:develop-ultimate - 終極品質開發協調引擎 / Ultimate Quality Development Orchestration Engine

## 觸發條件 Triggers / 觸發條件
- 需要最高品質的完整開發生命週期 / Need highest quality complete development lifecycle
- 複雜專案需要全方位 MCP 整合 / Complex projects requiring full MCP integration
- 企業級品質標準開發 / Enterprise-grade quality standard development
- 完整 Git 工作流程與 CI/CD 整合 / Complete Git workflow and CI/CD integration

## 終極架構設計 Ultimate Architecture Design / 終極架構設計

### 🧠 MCP 全整合協作矩陣
```yaml
MCP協作層級:
  Tier-1_核心推理: Sequential (主導多步驟分析決策)
  Tier-2_知識整合: Context7 + Serena (文檔模式 + 專案記憶)
  Tier-3_實作引擎: Magic + Morphllm (UI生成 + 批量轉換)
  Tier-4_驗證測試: Playwright (完整 E2E 測試覆蓋)
  Tier-5_持久記憶: Serena (跨會話專案狀態管理)
```

### 📊 智能品質檢測矩陣
```yaml
品質檢測維度:
  代碼品質: ESLint + Prettier + SonarQube 整合
  安全檢測: SAST + DAST + 依賴漏洞掃描
  性能監控: Lighthouse + Bundle Analyzer + 記憶體洩漏檢測
  測試覆蓋: Unit + Integration + E2E + Visual Regression
  文檔品質: API文檔自動生成 + 使用手冊完整性
  Git規範: Conventional Commits + 分支保護 + Code Review
```

## 行為流程 Behavioral Flow / 行為流程

### Phase 1: 智能專案初始化 / Intelligent Project Initialization
1. **專案狀態全面掃描** / Complete Project Status Scan
   - Serena 讀取專案記憶和開發歷史
   - Sequential 分析專案架構和技術債務
   - Context7 檢索專案相關的最佳實踐模式

2. **開發規範自動載入** / Auto-load Development Standards
   - 讀取 `.claude/standards/` 開發規範配置
   - 整合 ESLint/Prettier/TypeScript 規則
   - 載入專案特定的代碼審查標準

3. **Git 工作流程建立** / Git Workflow Establishment
   - 自動建立 feature branches 和 protection rules
   - 設定 PR templates 和 issue templates
   - 配置 GitHub Actions CI/CD pipeline

### Phase 2: 超級智能 Agent 編排 / Super Intelligent Agent Orchestration
4. **動態 Agent 專業化配置** / Dynamic Agent Specialization
   ```yaml
   Agent配置策略:
     專案類型檢測: 自動識別技術棧和業務領域
     Agent技能匹配: 根據專案需求分配專業Agent
     負載均衡優化: 智能分配開發任務避免衝突
     協作模式選擇: 並行/串行/混合協作模式
   ```

5. **MCP 超級加速開發** / MCP Super-Accelerated Development
   - Magic: 自動生成 UI 組件和設計系統
   - Morphllm: 批量代碼重構和模式應用
   - Context7: 即時官方文檔查詢和最佳實踐
   - Sequential: 複雜架構決策和問題解決推理

### Phase 3: 全方位品質保證 / Comprehensive Quality Assurance
6. **多維度品質檢測** / Multi-dimensional Quality Detection
   ```bash
   品質檢測管道:
   ├── 靜態代碼分析: ESLint + TypeScript + SonarQube
   ├── 安全漏洞掃描: npm audit + SAST tools
   ├── 性能基準測試: Lighthouse + Bundle size analysis
   ├── 視覺回歸測試: Playwright visual comparisons
   ├── API 文檔生成: OpenAPI + 自動化文檔
   └── 可訪問性檢測: WCAG 2.1 AA 標準驗證
   ```

7. **Playwright 完整測試覆蓋** / Complete Playwright Test Coverage
   - E2E 用戶流程測試
   - 跨瀏覽器相容性測試
   - 響應式設計測試
   - 可訪問性自動化測試

### Phase 4: Git 企業級工作流程 / Enterprise Git Workflow
8. **自動化 Git 操作** / Automated Git Operations
   ```bash
   Git工作流程:
   ├── Feature分支自動建立和命名規範
   ├── Conventional Commits 自動格式化
   ├── Pre-commit hooks 品質檢查
   ├── 自動 PR 建立和標準化描述
   ├── Code Review 自動分配和通知
   ├── CI/CD pipeline 自動觸發
   └── 自動 merge 和 deployment
   ```

9. **持續整合/持續部署** / CI/CD Integration
   - GitHub Actions 自動化 pipeline
   - 多環境部署策略 (dev/staging/prod)
   - 自動化測試執行和報告生成
   - 失敗自動回滾和通知機制

### Phase 5: 持久記憶和學習 / Persistent Memory and Learning
10. **Serena 專案記憶管理** / Serena Project Memory Management
    - 開發決策歷史記錄
    - 技術選擇和架構演進追蹤
    - 錯誤解決方案知識庫累積
    - 團隊開發模式和偏好學習

## 使用範例 Usage Examples / 使用範例

### 🚀 終極品質開發 (推薦)
```bash
/sccpm:develop-ultimate "crypto-trading-bot" \
  --mode enterprise \
  --agents 12 \
  --quality-gates strict \
  --git-workflow gitflow \
  --ci-cd github-actions \
  --standards .claude/standards/crypto-project.yml \
  --auto-deploy staging \
  --security-scan comprehensive \
  --performance-budget strict \
  --documentation auto-generate
```

### 🏢 企業級專案開發
```bash
/sccpm:develop-ultimate "fintech-platform" \
  --mode enterprise \
  --agents 16 \
  --compliance SOX \
  --security-level maximum \
  --audit-trail complete \
  --testing-coverage 95% \
  --documentation enterprise
```

### ⚡ 高性能系統開發
```bash
/sccpm:develop-ultimate "high-frequency-trading" \
  --mode performance \
  --agents 10 \
  --focus "latency,throughput,reliability" \
  --benchmarking continuous \
  --profiling deep \
  --optimization aggressive
```

## 核心行為 Core Behaviors / 核心行為

### 🎯 智能決策引擎
- **技術選擇**: 基於專案需求自動選擇最適合的技術棧和工具
- **架構優化**: Sequential MCP 提供深度架構分析和優化建議
- **性能調優**: 持續性能監控和自動化優化建議
- **安全加固**: 全方位安全檢測和漏洞修復自動化

### 🔄 持續改進循環
- **代碼品質**: 實時代碼品質監控和自動重構建議
- **測試優化**: 智能測試案例生成和覆蓋率優化
- **文檔同步**: 代碼變更自動觸發文檔更新
- **知識累積**: 專案經驗自動記錄和重複利用

執行完整的終極品質開發協調工作流程：
Execute the complete ultimate quality development orchestration workflow:

Run `bash .claude/scripts/sccpm/develop-ultimate.sh "$@"` using a sub-agent and show me the complete output.

- DO NOT truncate. / 不要截斷
- DO NOT collapse. / 不要摺疊
- DO NOT abbreviate. / 不要縮寫
- Show ALL lines in full. / 顯示所有完整行
- DO NOT print any other comments. / 不要印出任何其他評論