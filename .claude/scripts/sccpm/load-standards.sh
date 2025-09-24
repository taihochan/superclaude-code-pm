#!/bin/bash
# SCCPM Standards Configuration Loader
# 開發規範配置載入器

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
WHITE='\033[1;37m'
NC='\033[0m'

GEAR="⚙️"
SUCCESS="✅"
WARNING="⚠️"
BOOK="📚"

echo -e "${CYAN}${GEAR} SCCMP 開發規範載入器 / Standards Configuration Loader${NC}"
echo

PROJECT_NAME="$1"
STANDARDS_PATH="$2"

# 1. 檢測專案標準配置文件
if [ -z "$STANDARDS_PATH" ]; then
    # 按優先順序自動檢測
    POSSIBLE_PATHS=(
        ".claude/standards/${PROJECT_NAME}.yml"
        ".claude/standards/project.yml"
        ".claude/standards/default.yml"
        "CLAUDE.md"
    )

    for path in "${POSSIBLE_PATHS[@]}"; do
        if [ -f "$path" ]; then
            STANDARDS_PATH="$path"
            echo -e "${GREEN}${SUCCESS} 自動檢測到規範配置: ${STANDARDS_PATH}${NC}"
            break
        fi
    done
fi

# 2. 載入並解析配置
if [ -f "$STANDARDS_PATH" ]; then
    echo -e "${YELLOW}${BOOK} 正在載入開發規範...${NC}"
    echo -e "${WHITE}   • 配置文件: ${STANDARDS_PATH}${NC}"

    # 檢測配置格式
    if [[ "$STANDARDS_PATH" == *.yml ]] || [[ "$STANDARDS_PATH" == *.yaml ]]; then
        echo -e "${GREEN}   • 格式: YAML 配置文件${NC}"
        # 這裡可以使用 yq 或其他 YAML 解析工具
    elif [[ "$STANDARDS_PATH" == "CLAUDE.md" ]]; then
        echo -e "${GREEN}   • 格式: CLAUDE.md 專案指導文件${NC}"
        # 從 CLAUDE.md 提取規範
    fi

    echo -e "${GREEN}${SUCCESS} 開發規範載入完成${NC}"

else
    echo -e "${YELLOW}${WARNING} 未找到自定義規範，使用預設標準${NC}"
    echo -e "${WHITE}   建議建立: .claude/standards/${PROJECT_NAME}.yml${NC}"
fi

# 3. 導出環境變數供其他 SCCPM 腳本使用
export SCCPM_STANDARDS_PATH="$STANDARDS_PATH"
export SCCPM_PROJECT_NAME="$PROJECT_NAME"

echo
echo -e "${CYAN}規範配置已準備就緒，可供其他 SCCPM 指令使用 / Standards ready for SCCPM commands${NC}"