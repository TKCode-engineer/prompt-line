#!/bin/bash

# Prompt Line 自動起動スクリプト (システム起動時用)
# 使用方法: ~/.bashrc や .profile に追加

# ディレクトリ設定
PROMPT_LINE_DIR="/home/taka/workspace/prompt-line"
STARTUP_SCRIPT="$PROMPT_LINE_DIR/start-prompt-line-persistent.sh"

# WSL環境でのみ実行
if [[ -n "$WSL_DISTRO_NAME" ]] && [[ "$TERM_PROGRAM" == "WezTerm" ]]; then
    # Prompt Lineディレクトリの存在確認
    if [[ -d "$PROMPT_LINE_DIR" ]] && [[ -x "$STARTUP_SCRIPT" ]]; then
        # 起動チェック関数
        check_prompt_line_running() {
            local lock_file="$PROMPT_LINE_DIR/.prompt-line.lock"
            if [[ -f "$lock_file" ]]; then
                local pid=$(cat "$lock_file" 2>/dev/null)
                if [[ -n "$pid" ]] && ps -p "$pid" > /dev/null 2>&1; then
                    return 0  # 起動中
                fi
            fi
            return 1  # 停止中
        }
        
        # 起動していない場合のみ起動
        if ! check_prompt_line_running; then
            echo "🚀 Prompt Line を自動起動中..."
            # バックグラウンドで起動（ターミナル起動をブロックしない）
            (
                cd "$PROMPT_LINE_DIR"
                ./start-prompt-line-persistent.sh start > /dev/null 2>&1
            ) &
            
            # 短時間待機して結果確認
            sleep 2
            if check_prompt_line_running; then
                echo "✅ Prompt Line が正常に起動しました (Ctrl+Alt+Space で使用)"
            fi
        fi
    fi
fi