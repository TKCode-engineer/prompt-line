#!/bin/bash
# WSL環境用のPrompt Line バックグラウンドアクティベーション
# wezterm.luaからの呼び出し時にウィンドウ点滅を防ぐ版

# リダイレクトですべての出力を非表示にしてバックグラウンド実行
{
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SIGNAL_LOCK_FILE="$SCRIPT_DIR/.prompt-line-signal.lock"
    
    # シグナル重複防止チェック
    if [ -f "$SIGNAL_LOCK_FILE" ]; then
        signal_time=$(stat -c %Y "$SIGNAL_LOCK_FILE" 2>/dev/null || echo 0)
        current_time=$(date +%s)
        time_diff=$((current_time - signal_time))
        
        if [ $time_diff -lt 1 ]; then
            exit 0
        fi
    fi
    
    # シグナルロックファイルを作成
    touch "$SIGNAL_LOCK_FILE"
    
    # 最新のPrompt Lineインスタンスを検出
    latest_lock=$(find "$SCRIPT_DIR" -name ".prompt-line-*.lock" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2)
    
    PID=""
    if [ -n "$latest_lock" ] && [ -f "$latest_lock" ]; then
        STORED_PID=$(cat "$latest_lock")
        if ps -p "$STORED_PID" > /dev/null 2>&1; then
            if ps -p "$STORED_PID" -o comm= 2>/dev/null | grep -q "npm"; then
                ELECTRON_PID=$(pgrep -P "$STORED_PID" | head -1)
                if [ -n "$ELECTRON_PID" ] && ps -p "$ELECTRON_PID" -o comm= 2>/dev/null | grep -q "electron"; then
                    PID="$ELECTRON_PID"
                else
                    PID="$STORED_PID"
                fi
            fi
        fi
    fi
    
    # マニュアル検索（ロックファイルが無効な場合）
    if [ -z "$PID" ]; then
        LATEST_NPM_PID=$(ps aux | grep '[n]pm start' | awk '{print $2, $9}' | sort -k2 -n | tail -1 | awk '{print $1}')
        if [ -n "$LATEST_NPM_PID" ]; then
            ELECTRON_PID=$(pstree -p "$LATEST_NPM_PID" | grep -o 'electron([0-9]*)' | head -1 | grep -o '[0-9]*')
            if [ -n "$ELECTRON_PID" ]; then
                PID="$ELECTRON_PID"
            else
                PID="$LATEST_NPM_PID"
            fi
        fi
    fi
    
    # シグナル送信
    if [ -n "$PID" ]; then
        if kill -USR1 $PID 2>/dev/null; then
            sleep 1
            rm -f "$SIGNAL_LOCK_FILE"
        else
            rm -f "$SIGNAL_LOCK_FILE"
            exit 1
        fi
    else
        rm -f "$SIGNAL_LOCK_FILE"
        exit 1
    fi
} >/dev/null 2>&1 &