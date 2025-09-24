#!/bin/bash

# SuperClaude Code PM - 整合框架命令幫助工具
# 顯示所有可用的 /integrated:* 命令和使用說明

set -euo pipefail

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 圖標定義
ROCKET="🚀"
GEAR="⚙️"
BOOK="📚"
LIGHTBULB="💡"
STAR="⭐"
ARROW="→"
CHECK="✅"
INFO="ℹ️"
WARNING="⚠️"

echo ""
echo -e "${CYAN}${ROCKET} SuperClaude Code PM 整合框架${NC}"
echo -e "${CYAN}====================================${NC}"
echo ""
echo -e "${WHITE}CCPM+SuperClaude 完美整合的智能項目管理平台${NC}"
echo ""

echo -e "${GREEN}${BOOK} 可用命令列表${NC}"
echo -e "${GREEN}─────────────────${NC}"
echo ""

# 函數：顯示命令
show_command() {
    local cmd="$1"
    local desc="$2"
    local example="$3"
    local status="$4"

    local status_icon=""
    local status_color=""

    case $status in
        "active")
            status_icon="$CHECK"
            status_color="$GREEN"
            ;;
        "beta")
            status_icon="$WARNING"
            status_color="$YELLOW"
            ;;
        "planned")
            status_icon="$INFO"
            status_color="$BLUE"
            ;;
    esac

    echo -e "${PURPLE}/integrated:${cmd}${NC}"
    echo -e "  ${status_icon} ${status_color}狀態${NC}: $status"
    echo -e "  ${ARROW} ${WHITE}功能${NC}: $desc"
    echo -e "  ${LIGHTBULB} ${WHITE}使用${NC}: $example"
    echo ""
}

# 核心命令
echo -e "${YELLOW}${GEAR} 核心管理命令${NC}"
echo -e "${YELLOW}──────────────────${NC}"
echo ""

show_command "help" "顯示整合框架命令幫助和使用指南" "/integrated:help" "active"

show_command "status" "檢查 CCPM+SuperClaude 整合框架狀態" "/integrated:status" "active"

# 系統管理命令
echo -e "${YELLOW}${GEAR} 系統管理命令${NC}"
echo -e "${YELLOW}──────────────────${NC}"
echo ""

show_command "init" "初始化整合框架配置和環境" "/integrated:init [--force] [--config=path]" "beta"

show_command "config" "管理整合框架配置設定" "/integrated:config [set|get|list] [key] [value]" "beta"

show_command "update" "更新整合框架和相關組件" "/integrated:update [--check-only] [--component=name]" "beta"

# 協作功能命令
echo -e "${YELLOW}${STAR} 協作功能命令${NC}"
echo -e "${YELLOW}──────────────────${NC}"
echo ""

show_command "sync" "同步 CCPM 和 SuperClaude 狀態" "/integrated:sync [--direction=both|ccpm|superclaude]" "beta"

show_command "bridge" "建立跨系統通信橋接" "/integrated:bridge [start|stop|status]" "planned"

show_command "workflow" "啟動整合工作流程" "/integrated:workflow [name] [--params=json]" "planned"

# 分析和報告命令
echo -e "${YELLOW}${BOOK} 分析報告命令${NC}"
echo -e "${YELLOW}──────────────────${NC}"
echo ""

show_command "analyze" "執行跨系統分析和整合報告" "/integrated:analyze [--scope=project|epic|all] [--format=md|json]" "planned"

show_command "metrics" "顯示整合框架性能指標" "/integrated:metrics [--period=day|week|month]" "planned"

show_command "audit" "執行整合框架安全性審計" "/integrated:audit [--deep] [--fix]" "planned"

# 開發和調試命令
echo -e "${YELLOW}${LIGHTBULB} 開發調試命令${NC}"
echo -e "${YELLOW}──────────────────${NC}"
echo ""

show_command "debug" "啟動整合框架調試模式" "/integrated:debug [component] [--verbose]" "beta"

show_command "test" "執行整合框架測試套件" "/integrated:test [--suite=unit|integration|e2e]" "beta"

show_command "logs" "查看整合框架運行日誌" "/integrated:logs [--level=info|warn|error] [--tail=N]" "beta"

# 使用指南
echo -e "${CYAN}${BOOK} 使用指南${NC}"
echo -e "${CYAN}─────────${NC}"
echo ""

echo -e "${WHITE}基本工作流程：${NC}"
echo -e "  1. ${ARROW} 執行 ${PURPLE}/integrated:status${NC} 檢查系統狀態"
echo -e "  2. ${ARROW} 使用 ${PURPLE}/integrated:init${NC} 初始化配置（首次使用）"
echo -e "  3. ${ARROW} 執行 ${PURPLE}/integrated:sync${NC} 同步系統狀態"
echo -e "  4. ${ARROW} 開始使用整合功能進行項目管理"
echo ""

echo -e "${WHITE}最佳實踐：${NC}"
echo -e "  ${CHECK} 定期執行 ${PURPLE}/integrated:status${NC} 監控系統健康"
echo -e "  ${CHECK} 使用 ${PURPLE}/integrated:metrics${NC} 追蹤性能表現"
echo -e "  ${CHECK} 遇到問題時執行 ${PURPLE}/integrated:debug${NC} 進行診斷"
echo -e "  ${CHECK} 更新前使用 ${PURPLE}/integrated:audit${NC} 檢查安全性"
echo ""

echo -e "${WHITE}高級功能：${NC}"
echo -e "  ${STAR} 使用 ${PURPLE}/integrated:workflow${NC} 自動化複雜任務流程"
echo -e "  ${STAR} 透過 ${PURPLE}/integrated:bridge${NC} 建立即時跨系統通信"
echo -e "  ${STAR} 使用 ${PURPLE}/integrated:analyze${NC} 生成深度分析報告"
echo ""

echo -e "${YELLOW}${INFO} 狀態說明${NC}"
echo -e "${YELLOW}─────────${NC}"
echo -e "  ${CHECK} ${GREEN}active${NC}   - 功能完整可用"
echo -e "  ${WARNING} ${YELLOW}beta${NC}     - 功能開發中，可能不穩定"
echo -e "  ${INFO} ${BLUE}planned${NC}  - 已規劃，即將開發"
echo ""

echo -e "${CYAN}${ROCKET} 技術支援${NC}"
echo -e "${CYAN}─────────${NC}"
echo -e "  📧 問題回報：https://github.com/taihochan/superclaude-code-pm/issues"
echo -e "  📖 完整文檔：https://github.com/taihochan/superclaude-code-pm/wiki"
echo -e "  💬 討論社群：https://github.com/taihochan/superclaude-code-pm/discussions"
echo ""

echo -e "${WHITE}版本信息：SuperClaude Code PM v1.0.0${NC}"
echo -e "${WHITE}整合框架：CCPM+SuperClaude Integration v1.0.0${NC}"
echo ""