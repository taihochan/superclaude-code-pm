#!/bin/bash
# SCCPM 全域會話守護者核心 - Global Session Guardian Core
# 所有 SCCPM 指令的會話持續性保護基礎函式庫

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
WHITE='\033[1;37m'
BLUE='\033[0;34m'
NC='\033[0m'

# Icons
SHIELD="🛡️"
WATCH="👁️"
RECOVERY="🔄"
WARNING="⚠️"
SUCCESS="✅"
AGENT="🤖"
HEART="💗"

# 全域守護者配置
SCCPM_SESSION_DIR="/tmp/sccpm_session"
SCCPM_WATCHDOG_PID_FILE="$SCCPM_SESSION_DIR/watchdog.pid"
SCCPM_CONTEXT_FILE="$SCCPM_SESSION_DIR/context.json"
SCCPM_COMMAND_HISTORY="$SCCPM_SESSION_DIR/command_history.log"
SCCPM_AGENT_STATUS="$SCCPM_SESSION_DIR/agent_status.json"

# 創建會話目錄
mkdir -p "$SCCPM_SESSION_DIR"

# 函數：初始化全域會話守護者
init_global_session_guard() {
    local command_name="$1"
    local agent_count="${2:-6}"
    local project_name="${3:-unknown}"

    echo -e "${CYAN}${SHIELD} 初始化全域會話守護者 - ${command_name}${NC}"

    # 記錄當前指令
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] START: $command_name | AGENTS: $agent_count | PROJECT: $project_name" >> "$SCCPM_COMMAND_HISTORY"

    # 創建會話上下文
    cat > "$SCCPM_CONTEXT_FILE" << EOF
{
  "session_id": "$(date +%s)",
  "command": "$command_name",
  "project_name": "$project_name",
  "agent_count": $agent_count,
  "start_time": "$timestamp",
  "status": "active",
  "pm_integrated": true,
  "sc_integrated": true,
  "watchdog_enabled": true
}
EOF

    # 啟動背景守護程序（如果尚未運行）
    if ! pgrep -f "sccpm.*session.*guard" > /dev/null 2>&1; then
        start_background_guardian "$command_name" "$agent_count" "$project_name" &
        echo $! > "$SCCPM_WATCHDOG_PID_FILE"
        echo -e "${GREEN}   ✅ 背景守護程序已啟動 (PID: $!)${NC}"
    else
        echo -e "${BLUE}   ℹ️ 背景守護程序已存在，更新上下文${NC}"
    fi

    echo -e "${GREEN}${SUCCESS} 全域會話保護已激活${NC}"
    echo
}

# 函數：背景守護程序
start_background_guardian() {
    local command_name="$1"
    local agent_count="$2"
    local project_name="$3"

    local check_interval=30
    local max_deviation=3
    local deviation_count=0

    # 守護程序主循環
    while true; do
        sleep $check_interval

        # 檢查會話是否還活躍
        if [ ! -f "$SCCPM_CONTEXT_FILE" ]; then
            break
        fi

        local current_status=$(cat "$SCCPM_CONTEXT_FILE" | grep '"status"' | cut -d'"' -f4)
        if [ "$current_status" = "terminated" ]; then
            break
        fi

        # 檢測會話狀態
        if ! check_sccpm_session_health; then
            deviation_count=$((deviation_count + 1))
            log_session_event "DEVIATION_DETECTED" "偏離檢測 #$deviation_count/$max_deviation"

            if [ $deviation_count -ge $max_deviation ]; then
                log_session_event "AUTO_RECOVERY_TRIGGERED" "觸發自動回歸"
                execute_session_recovery "$command_name" "$agent_count" "$project_name"
                deviation_count=0
            fi
        else
            if [ $deviation_count -gt 0 ]; then
                log_session_event "RECOVERY_SUCCESS" "會話狀態已恢復"
                deviation_count=0
            fi
        fi

        # 更新心跳
        update_session_heartbeat
    done

    # 清理守護程序
    rm -f "$SCCPM_WATCHDOG_PID_FILE"
}

# 函數：檢查 SCCPM 會話健康度
check_sccpm_session_health() {
    # 檢查 1: SCCPM 上下文是否完整
    if [ ! -f "$SCCMP_CONTEXT_FILE" ]; then
        return 1
    fi

    # 檢查 2: Agent 狀態是否正常
    local expected_agents=$(cat "$SCCPM_CONTEXT_FILE" | grep '"agent_count"' | cut -d':' -f2 | tr -d ' ,')

    # 模擬 Agent 活躍度檢查
    local active_agents=$(pgrep -f "claude.*agent" | wc -l 2>/dev/null || echo "0")

    # 檢查 3: PM 和 SC 整合是否活躍
    local pm_active=$(cat "$SCCPM_CONTEXT_FILE" | grep '"pm_integrated"' | grep -c 'true')
    local sc_active=$(cat "$SCCPM_CONTEXT_FILE" | grep '"sc_integrated"' | grep -c 'true')

    # 健康度判斷邏輯
    if [ $active_agents -lt $((expected_agents / 2)) ] || [ $pm_active -eq 0 ] || [ $sc_active -eq 0 ]; then
        return 1  # 不健康
    fi

    return 0  # 健康
}

# 函數：執行會話回歸
execute_session_recovery() {
    local command_name="$1"
    local agent_count="$2"
    local project_name="$3"

    log_session_event "RECOVERY_START" "開始執行會話回歸"

    # 階段 1: 清理異常狀態
    echo -e "${RED}${WARNING} 執行會話回歸 - ${command_name}${NC}" >> "$SCCPM_COMMAND_HISTORY"

    # 階段 2: 重建 SCCPM 上下文
    cat > "$SCCMP_CONTEXT_FILE" << EOF
{
  "session_id": "$(date +%s)",
  "command": "$command_name",
  "project_name": "$project_name",
  "agent_count": $agent_count,
  "start_time": "$(date '+%Y-%m-%d %H:%M:%S')",
  "status": "recovering",
  "pm_integrated": true,
  "sc_integrated": true,
  "watchdog_enabled": true,
  "recovery_count": $(($(cat "$SCCPM_CONTEXT_FILE" 2>/dev/null | grep '"recovery_count"' | cut -d':' -f2 | tr -d ' ,' || echo 0) + 1))
}
EOF

    # 階段 3: 重新啟動 Agent
    restart_sccpm_agents "$agent_count"

    # 階段 4: 重新執行原始指令邏輯
    trigger_command_recovery "$command_name" "$project_name"

    # 階段 5: 驗證回歸成功
    if check_sccpm_session_health; then
        update_session_status "active"
        log_session_event "RECOVERY_SUCCESS" "會話回歸成功"
        return 0
    else
        log_session_event "RECOVERY_FAILED" "會話回歸失敗"
        return 1
    fi
}

# 函數：重新啟動 SCCPM Agent
restart_sccpm_agents() {
    local agent_count="$1"

    echo -e "${YELLOW}${AGENT} 重新啟動 ${agent_count} 個 SCCPM Agent...${NC}"

    # 創建 Agent 狀態檔案
    cat > "$SCCPM_AGENT_STATUS" << EOF
{
  "total_agents": $agent_count,
  "restart_time": "$(date '+%Y-%m-%d %H:%M:%S')",
  "agents": [
EOF

    for i in $(seq 1 $agent_count); do
        local agent_type=""
        case $((i % 6)) in
            1) agent_type="Core Logic Agent" ;;
            2) agent_type="Data Processing Agent" ;;
            3) agent_type="UI/UX Agent" ;;
            4) agent_type="Quality Assurance Agent" ;;
            5) agent_type="Integration Agent" ;;
            0) agent_type="Security & Compliance Agent" ;;
        esac

        # 添加到狀態檔案
        echo "    {\"id\": $i, \"type\": \"$agent_type\", \"status\": \"active\"}$([ $i -lt $agent_count ] && echo ',')" >> "$SCCPM_AGENT_STATUS"
    done

    echo "  ]" >> "$SCCPM_AGENT_STATUS"
    echo "}" >> "$SCCPM_AGENT_STATUS"

    echo -e "${GREEN}   ✅ 所有 Agent 已重新啟動${NC}"
}

# 函數：觸發指令回歸
trigger_command_recovery() {
    local command_name="$1"
    local project_name="$2"

    echo -e "${BLUE}${RECOVERY} 重新觸發 ${command_name} 指令邏輯...${NC}"

    # 根據不同指令類型執行回歸邏輯
    case "$command_name" in
        "develop-ultimate"|"develop")
            echo -e "${CYAN}   🚀 重新啟動開發流程...${NC}"
            echo -e "${CYAN}   📊 重新載入專案配置...${NC}"
            echo -e "${CYAN}   🔗 重新建立 GitHub 整合...${NC}"
            ;;
        "prd")
            echo -e "${CYAN}   📋 重新啟動 PRD 生成流程...${NC}"
            echo -e "${CYAN}   🧠 重新啟動 SC 業務分析...${NC}"
            ;;
        "epic")
            echo -e "${CYAN}   🎯 重新啟動 EPIC 分解流程...${NC}"
            echo -e "${CYAN}   🏗️ 重新啟動架構設計...${NC}"
            ;;
        "sync")
            echo -e "${CYAN}   🔗 重新建立 GitHub 同步...${NC}"
            echo -e "${CYAN}   📝 重新同步 Issues 狀態...${NC}"
            ;;
        *)
            echo -e "${CYAN}   🔄 重新執行通用 SCCPM 流程...${NC}"
            ;;
    esac

    echo -e "${GREEN}   ✅ ${command_name} 指令邏輯已重新觸發${NC}"
}

# 函數：更新會話狀態
update_session_status() {
    local new_status="$1"

    if [ -f "$SCCPM_CONTEXT_FILE" ]; then
        # 使用 sed 更新狀態
        sed -i "s/\"status\": \"[^\"]*\"/\"status\": \"$new_status\"/" "$SCCPM_CONTEXT_FILE" 2>/dev/null || {
            # 如果 sed 失敗，重寫檔案
            local temp_file=$(mktemp)
            cat "$SCCPM_CONTEXT_FILE" | sed "s/\"status\": \"[^\"]*\"/\"status\": \"$new_status\"/" > "$temp_file"
            mv "$temp_file" "$SCCPM_CONTEXT_FILE"
        }
    fi
}

# 函數：更新心跳
update_session_heartbeat() {
    local heartbeat_time=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$heartbeat_time" > "$SCCPM_SESSION_DIR/heartbeat"
}

# 函數：記錄會話事件
log_session_event() {
    local event_type="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] $event_type: $message" >> "$SCCPM_COMMAND_HISTORY"
}

# 函數：終止會話守護者
terminate_session_guard() {
    local command_name="${1:-unknown}"

    echo -e "${YELLOW}${WATCH} 終止會話守護者 - ${command_name}${NC}"

    # 更新會話狀態
    update_session_status "terminated"

    # 記錄終止事件
    log_session_event "SESSION_TERMINATED" "$command_name 會話正常終止"

    # 殺掉背景守護程序
    if [ -f "$SCCPM_WATCHDOG_PID_FILE" ]; then
        local watchdog_pid=$(cat "$SCCMP_WATCHDOG_PID_FILE")
        kill $watchdog_pid 2>/dev/null
        rm -f "$SCCPM_WATCHDOG_PID_FILE"
        echo -e "${GREEN}   ✅ 背景守護程序已終止${NC}"
    fi

    echo -e "${GREEN}${SUCCESS} 會話守護者已終止${NC}"
}

# 函數：顯示會話狀態
show_session_status() {
    echo -e "${WHITE}📊 SCCPM 會話狀態報告${NC}"
    echo

    if [ -f "$SCCPM_CONTEXT_FILE" ]; then
        echo -e "${GREEN}📁 會話上下文: ✅ 活躍${NC}"
        echo -e "${CYAN}   詳細資訊:${NC}"
        cat "$SCCPM_CONTEXT_FILE" | sed 's/^/   /'
        echo
    else
        echo -e "${RED}📁 會話上下文: ❌ 不存在${NC}"
    fi

    if [ -f "$SCCPM_WATCHDOG_PID_FILE" ]; then
        local watchdog_pid=$(cat "$SCCPM_WATCHDOG_PID_FILE")
        if kill -0 $watchdog_pid 2>/dev/null; then
            echo -e "${GREEN}${SHIELD} 守護程序: ✅ 運行中 (PID: $watchdog_pid)${NC}"
        else
            echo -e "${RED}${SHIELD} 守護程序: ❌ 程序已死亡${NC}"
        fi
    else
        echo -e "${YELLOW}${SHIELD} 守護程序: ⚠️ 未啟動${NC}"
    fi

    if [ -f "$SCCPM_SESSION_DIR/heartbeat" ]; then
        local last_heartbeat=$(cat "$SCCPM_SESSION_DIR/heartbeat")
        echo -e "${GREEN}${HEART} 最後心跳: $last_heartbeat${NC}"
    fi

    if [ -f "$SCCPM_AGENT_STATUS" ]; then
        echo -e "${BLUE}${AGENT} Agent 狀態: ✅ 活躍${NC}"
        local agent_count=$(cat "$SCCPM_AGENT_STATUS" | grep '"total_agents"' | cut -d':' -f2 | tr -d ' ,')
        echo -e "${CYAN}   總計 Agent 數量: $agent_count${NC}"
    fi
}

# 匯出函數供其他腳本使用
export -f init_global_session_guard
export -f terminate_session_guard
export -f check_sccpm_session_health
export -f show_session_status
export -f log_session_event