# /sccpm:help - SCCPM Command Reference / SCCPM 指令參考

## SCCPM (SuperClaude Code PM) Framework Overview
## SCCPM (超級克勞德代碼專案管理) 框架概述

SCCPM is the ultimate dual-engine collaboration framework that combines CCPM's structured project management with SuperClaude's intelligent optimization capabilities.

SCCPM 是結合 CCPM 結構化專案管理與 SuperClaude 智能優化能力的終極雙引擎協作框架。

## 🔧 Core Lifecycle Commands / 核心生命週期指令

### **Project Initialization & Planning / 專案初始化與規劃**

| Command / 指令 | Description / 說明 | Workflow / 工作流程 |
|---|---|---|
| `/sccpm:prd <name>` | PRD Generation & Optimization<br/>PRD 生成與優化 | CCPM structure → SC business analysis → CCPM integration<br/>CCPM 結構 → SC 商業分析 → CCPM 整合 |
| `/sccpm:epic <prd>` | EPIC Decomposition & Design<br/>EPIC 分解與設計 | CCPM decomposition → SC architecture → CCPM sync<br/>CCPM 分解 → SC 架構 → CCPM 同步 |
| `/sccpm:issue <epic>` | Issue Management & Enhancement<br/>Issue 管理與增強 | CCPM issues → SC technical specs → CCPM tracking<br/>CCPM 議題 → SC 技術規格 → CCPM 追蹤 |

### **Development Execution / 開發執行**

| Command / 指令 | Description / 說明 | Collaboration Model / 協作模式 |
|---|---|---|
| `/sccpm:develop <project>` | Multi-Agent Development Orchestration<br/>多代理開發協調 | CCPM master control + SuperClaude parallel agents<br/>CCPM 主控 + SuperClaude 並行代理 |

### **Quality & Analysis / 品質與分析**

| Command / 指令 | Description / 說明 | Focus Areas / 重點領域 |
|---|---|---|
| `/sccpm:analyze <scope>` | Deep Code Analysis & Architecture Review<br/>深度代碼分析與架構審查 | Architecture, Security, Performance, Quality<br/>架構、安全、性能、品質 |
| `/sccpm:test <target>` | Comprehensive Testing & Quality Assurance<br/>綜合測試與品質保證 | Unit, Integration, E2E, Performance, Security<br/>單元、整合、端到端、性能、安全 |
| `/sccpm:review <code>` | Code Review & Quality Enhancement<br/>代碼審查與品質提升 | Multi-expert review + automated quality gates<br/>多專家審查 + 自動化品質門檻 |

### **Deployment & Operations / 部署與操作**

| Command / 指令 | Description / 說明 | Integration / 整合 |
|---|---|---|
| `/sccpm:deploy <env>` | Deployment Pipeline & Release Management<br/>部署管道與發布管理 | Zero-downtime deployment + health monitoring<br/>零宕機部署 + 健康監控 |

### **Team Management / 團隊管理**

| Command / 指令 | Description / 說明 | Real-time Capabilities / 即時能力 |
|---|---|---|
| `/sccpm:standup` | Daily Progress & Team Reporting<br/>每日進度與團隊報告 | Automated reports + performance insights<br/>自動化報告 + 性能洞察 |
| `/sccpm:orchestrate <mode>` | Multi-Agent Orchestration<br/>多代理協調 | Master controller for parallel SC agents<br/>並行 SC 代理的主控制器 |
| `/sccpm:status` | System Status & Health Check<br/>系統狀態與健康檢查 | CCPM + SC integration status monitoring<br/>CCPM + SC 整合狀態監控 |

## 🎯 Advanced Features / 進階功能

### **Intelligent Optimization / 智能優化**
- **Dual-Engine Collaboration / 雙引擎協作**: CCPM structure + SuperClaude intelligence
- **Multi-Agent Orchestration / 多代理協調**: Up to 8 parallel SuperClaude agents
- **Real-time Quality Assurance / 即時品質保證**: Continuous monitoring and optimization

### **Enterprise Integration / 企業整合**
- **GitHub Integration / GitHub 整合**: Automated issue, milestone, and PR management
- **Team Collaboration / 團隊協作**: Intelligent developer assignment and progress tracking
- **Performance Metrics / 性能指標**: Comprehensive analytics and reporting

## 🚀 Quick Start Workflow / 快速開始工作流程

```bash
# Complete Project Lifecycle / 完整專案生命週期
/sccpm:prd "我的新專案"           # 1. Generate optimized PRD / 生成優化 PRD
/sccpm:epic "我的新專案PRD"      # 2. Decompose into EPICs / 分解為 EPIC
/sccpm:issue "我的新專案EPIC"    # 3. Create detailed Issues / 創建詳細 Issues
/sccpm:develop "我的新專案" --mode intensive --agents 8  # 4. Execute parallel development / 執行並行開發

# Ongoing Development & Quality / 持續開發與品質
/sccpm:analyze src/              # Code analysis / 代碼分析
/sccpm:test --comprehensive      # Full testing / 完整測試
/sccpm:deploy staging            # Deploy to staging / 部署到測試環境
/sccpm:status                    # Check system health / 檢查系統健康
```

## 💡 Best Practices / 最佳實踐

### **Workflow Optimization / 工作流程優化**
1. **Sequential Phases / 順序階段**: Always complete PRD → EPIC → Issues before development
2. **Parallel Execution / 並行執行**: Use multiple agents for maximum efficiency
3. **Quality Gates / 品質門檻**: Regular analysis and testing throughout development

### **Team Collaboration / 團隊協作**
- **CCPM Leadership / CCPM 領導**: Let CCPM coordinate overall project structure
- **SuperClaude Expertise / SuperClaude 專業**: Leverage SC agents for specialized tasks
- **GitHub Integration / GitHub 整合**: Maintain sync with repository and issues

## 🔧 Configuration Flags / 配置標志

| Flag / 標志 | Purpose / 目的 | Example / 範例 |
|---|---|---|
| `--mode <type>` | Execution mode / 執行模式 | `--mode intensive` |
| `--agents <n>` | Number of agents / 代理數量 | `--agents 8` |
| `--focus <area>` | Specialization focus / 專業重點 | `--focus security` |
| `--quality-first` | Quality priority / 品質優先 | `--quality-first` |
| `--parallel-features` | Parallel development / 並行開發 | `--parallel-features` |

---

**SCCPM = Perfect fusion of structure and intelligence**
**SCCPM = 結構與智能的完美融合**

Execute specific commands for detailed workflows:
執行特定指令以獲得詳細工作流程：

Run `bash .claude/scripts/sccpm/help.sh "$@"` for interactive help system.
執行 `bash .claude/scripts/sccpm/help.sh "$@"` 獲得互動式幫助系統。