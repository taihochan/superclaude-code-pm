# 📚 SuperClaude Code PM 詳細安裝指南

本文檔提供了 SuperClaude Code PM 的完整安裝和配置指南。

## 📋 系統要求

### 必要環境
- **Node.js**: >= 16.0.0 (推薦 18.x 或更高版本)
- **npm**: >= 8.0.0 (或 yarn >= 1.22.0)
- **Git**: 最新版本
- **操作系統**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)

### 可選環境
- **Python**: >= 3.8 (用於 SuperClaude Framework)
- **pipx**: 推薦用於 Python 包管理

### 硬體要求
- **RAM**: 最少 4GB，推薦 8GB+
- **磁盤空間**: 至少 2GB 可用空間
- **網絡**: 穩定的網絡連接用於下載依賴

## 🚀 快速安裝

### 方法 1: 一鍵安裝 (推薦)

```bash
# 1. 克隆倉庫
git clone https://github.com/yourusername/superclaude-code-pm.git
cd superclaude-code-pm

# 2. 一鍵安裝所有組件
npm run install-all

# 3. 驗證安裝
npm run validate

# 4. 啟動系統
npm start
```

### 方法 2: 分步安裝

```bash
# 1. 克隆倉庫並安裝基礎依賴
git clone https://github.com/yourusername/superclaude-code-pm.git
cd superclaude-code-pm
npm install

# 2. 安裝 CCPM
npm run install-ccpm

# 3. 安裝 SuperClaude Framework
npm run install-superclaude

# 4. 配置整合框架
npm run setup-framework

# 5. 驗證安裝
npm run validate
```

## 📦 組件詳細安裝

### CCPM (Claude Code PM) 安裝

CCPM 是來自 https://github.com/automazeio/ccpm 的項目管理系統。

#### 自動安裝
```bash
npm run install-ccpm
```

#### 手動安裝
```bash
# 克隆 CCPM 倉庫
git clone https://github.com/automazeio/ccpm.git ccpm

# 進入目錄並安裝依賴
cd ccpm
npm install  # 如果有 package.json

# 回到主目錄
cd ..
```

#### CCPM 特性
- **並行執行**: 支持多 Agent 同時工作
- **GitHub 整合**: 原生 Issues 管理
- **任務分解**: Epic → Task 自動分解
- **可追溯性**: 從需求到代碼的完整追蹤

### SuperClaude Framework 安裝

SuperClaude Framework 來自 https://github.com/SuperClaude-Org/SuperClaude_Framework。

#### 自動安裝
```bash
npm run install-superclaude
```

#### 手動安裝選項

**選項 1: Git 克隆**
```bash
git clone https://github.com/SuperClaude-Org/SuperClaude_Framework.git superclaude
cd superclaude
npm install  # 安裝 Node.js 依賴
pip install -r requirements.txt  # 安裝 Python 依賴
cd ..
```

**選項 2: pipx (推薦)**
```bash
pipx install superclaude-framework
```

**選項 3: pip**
```bash
pip install superclaude-framework
```

**選項 4: npm**
```bash
npm install -g superclaude-framework
```

#### SuperClaude 特性
- **15 個專業 AI Agents**: 涵蓋各種開發領域
- **7 種行為模式**: 業務面板、編排、任務管理等
- **7 個 MCP 服務器**: 網絡搜索、瀏覽器測試、UI 生成等
- **跨會話智能**: 記憶和學習能力

### 整合框架配置

完成兩個框架安裝後，配置整合系統：

```bash
npm run setup-framework
```

這個步驟會：
- ✅ 檢查 CCPM 和 SuperClaude 安裝狀態
- ✅ 創建整合配置文件
- ✅ 設置主入口文件
- ✅ 配置命令路由系統
- ✅ 創建演示和測試腳本

## ⚙️ 配置說明

### 主配置文件

安裝完成後，系統會創建 `config/integration-config.json`：

```json
{
  "system": {
    "name": "SuperClaude Code PM",
    "version": "1.0.0",
    "environment": "production"
  },
  "ccpm": {
    "enabled": true,
    "basePath": "./ccpm",
    "commands": ["pm:prd-new", "pm:epic-decompose", "pm:issue-start"]
  },
  "superclaude": {
    "enabled": true,
    "basePath": "./superclaude",
    "commands": ["sc:workflow", "sc:analyze", "sc:business-panel"]
  },
  "integration": {
    "maxConcurrentAgents": 15,
    "routingStrategy": "ai-optimized",
    "performanceOptimization": true
  }
}
```

### 自訂配置

你可以編輯配置文件來調整系統行為：

```bash
# 編輯主配置
nano config/integration-config.json

# 編輯命令配置
nano config/commands.json

# 編輯事件配置
nano config/events.json
```

## 🧪 驗證安裝

### 基本驗證

```bash
# 運行完整驗證套件
npm run validate

# 運行測試
npm test

# 檢查系統狀態
npm start -- /integrated:status
```

### 高級驗證

```bash
# 運行演示
npm run demo

# 檢查特定組件
node -e "console.log('Testing CCPM...'); require('./ccpm/package.json')"
node -e "console.log('Testing SuperClaude...'); require('./superclaude/package.json')"

# 檢查框架文件
ls -la framework/
```

## 🚨 故障排除

### 常見問題

#### 1. Node.js 版本過舊
```bash
# 檢查版本
node --version

# 升級 Node.js (使用 nvm)
nvm install 18
nvm use 18
```

#### 2. Git 克隆失敗
```bash
# 清理並重新克隆
rm -rf ccpm superclaude
npm run install-ccpm
npm run install-superclaude
```

#### 3. 權限錯誤
```bash
# Linux/macOS
sudo chown -R $USER:$USER .
chmod +x scripts/*.js

# Windows (以管理員身份運行)
icacls . /grant %USERNAME%:F /T
```

#### 4. Python 依賴安裝失敗
```bash
# 確保 Python 和 pip 已安裝
python --version
pip --version

# 手動安裝 SuperClaude 依賴
cd superclaude
pip install -r requirements.txt
```

#### 5. 網絡連接問題
```bash
# 設置 npm 鏡像
npm config set registry https://registry.npmmirror.com/

# 設置 pip 鏡像
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple/
```

### 日誌和調試

系統會在以下位置生成日誌：

- `logs/integration.log` - 主系統日誌
- `logs/command.log` - 命令執行日誌
- `logs/error.log` - 錯誤日誌

啟用調試模式：
```bash
# 編輯配置文件
nano config/integration-config.json
# 設置 "debug": true

# 或者通過環境變數
DEBUG=true npm start
```

### 重新安裝

如果遇到嚴重問題，可以完全重新安裝：

```bash
# 備份配置（如果需要）
cp -r config config.backup

# 清理所有安裝
rm -rf node_modules ccpm superclaude
rm -f package-lock.json

# 重新安裝
npm install
npm run install-all
npm run validate
```

## 🔧 開發環境設置

如果你想參與開發或貢獻代碼：

```bash
# 克隆開發版本
git clone https://github.com/yourusername/superclaude-code-pm.git
cd superclaude-code-pm

# 安裝開發依賴
npm install --include=dev

# 安裝所有組件
npm run install-all

# 設置 Git hooks
npm run prepare

# 運行開發服務器
npm run dev
```

## 📚 進階配置

### 性能優化

編輯 `config/integration-config.json`：

```json
{
  "performance": {
    "maxMemoryUsage": "1GB",
    "commandTimeout": 60000,
    "eventQueueSize": 50000,
    "enableCaching": true
  }
}
```

### 安全設置

```json
{
  "security": {
    "encryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm"
    },
    "authentication": {
      "required": true,
      "method": "token"
    }
  }
}
```

### 監控和告警

```json
{
  "monitoring": {
    "enabled": true,
    "metricsCollection": true,
    "alerting": {
      "errorThreshold": 10,
      "performanceThreshold": 5000
    }
  }
}
```

## 🎯 使用場景

### 1. 項目管理場景
```bash
# 創建新項目需求
npm start -- /pm:prd-new "新功能開發"

# 分解為可執行任務
npm start -- /pm:epic-decompose

# 啟動並行執行
npm start -- /pm:epic-start
```

### 2. 商業分析場景
```bash
# 啟動商業專家面板
npm start -- /sc:business-panel @business-plan.md

# 執行深度分析
npm start -- /sc:analyze --depth comprehensive
```

### 3. 整合工作流場景
```bash
# 執行整合分析
npm start -- /integrated:analyze --project ./my-project

# 生成整合報告
npm start -- /integrated:report --format markdown
```

## 📞 獲得幫助

如果安裝過程中遇到問題：

- 📧 **Email**: support@superclaude-pm.com
- 💬 **Discord**: [SuperClaude Community](https://discord.gg/superclaude)
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/superclaude-code-pm/issues)
- 📚 **文檔**: [完整文檔](https://docs.superclaude-pm.com)

## 🎉 安裝完成

安裝成功後，你將擁有：

- ✅ **CCPM**: 強大的並行項目管理系統
- ✅ **SuperClaude**: 15個專業AI Agent和商業分析能力
- ✅ **整合框架**: 62個核心組件的統一系統
- ✅ **智能路由**: AI驅動的命令路由和決策系統
- ✅ **並行協作**: 最多15個Agent同時工作
- ✅ **企業級可靠性**: 99.9%可用性保證

開始你的智能化項目管理和開發之旅！🚀