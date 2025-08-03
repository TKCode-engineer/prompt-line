#!/bin/bash
# WSL環境用のPrompt Line アクティベーション

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# WSL個別インスタンス対応 - 最も最近のロックファイルを検出
SIGNAL_LOCK_FILE="$SCRIPT_DIR/.prompt-line-signal.lock"

# 既存のシグナルロックをチェック（重複防止）
if [ -f "$SIGNAL_LOCK_FILE" ]; then
    signal_time=$(stat -c %Y "$SIGNAL_LOCK_FILE" 2>/dev/null || echo 0)
    current_time=$(date +%s)
    time_diff=$((current_time - signal_time))
    
    # 1秒以内に他のシグナルが送信されていれば重複防止
    if [ $time_diff -lt 1 ]; then
        echo "🔄 最近シグナルが送信されました - 重複防止のためスキップ"
        exit 0
    fi
fi

# シグナルロックファイルを作成
touch "$SIGNAL_LOCK_FILE"

# 最も最近のPrompt Lineインスタンスを検出
LOCK_FILE=""
STORED_PID=""

# 死んだロックファイルをクリーンアップ
for lock_file in "$SCRIPT_DIR"/.prompt-line-*.lock; do
    if [ -f "$lock_file" ]; then
        pid=$(cat "$lock_file" 2>/dev/null)
        if ! ps -p "$pid" > /dev/null 2>&1; then
            echo "🧹 Removing dead lock file: $(basename "$lock_file") (PID: $pid)"
            rm -f "$lock_file"
        fi
    fi
done

# 全てのロックファイルから最新のものを選択
latest_lock=$(find "$SCRIPT_DIR" -name ".prompt-line-*.lock" -type f -printf '%T@ %p
' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2)

if [ -n "$latest_lock" ] && [ -f "$latest_lock" ]; then
    LOCK_FILE="$latest_lock"
    STORED_PID=$(cat "$LOCK_FILE")
    if ps -p "$STORED_PID" > /dev/null 2>&1; then
        # プロセスが存在し、実際にElectronプロセスかチェック
        if ps -p "$STORED_PID" -o comm= 2>/dev/null | grep -q "npm"; then
            echo "Found latest Prompt Line instance: $STORED_PID"
            # npmプロセスの子プロセス（Electron）を探す
            ELECTRON_PID=$(pgrep -P "$STORED_PID" | head -1)
            if [ -n "$ELECTRON_PID" ] && ps -p "$ELECTRON_PID" -o comm= 2>/dev/null | grep -q "electron"; then
                echo "Found Electron child process: $ELECTRON_PID"
                PID="$ELECTRON_PID"
            else
                echo "Electron child process not found, using npm PID: $STORED_PID"
                PID="$STORED_PID"
            fi
        else
            echo "Invalid process in lock file - searching manually"
            PID=""
        fi
    else
        echo "Lock file contains dead PID - searching manually"
        PID=""
    fi
fi

# マニュアル検索（ロックファイルが無効な場合）
if [ -z "$PID" ]; then
    # 最も最新のnpm startプロセスを見つける
    LATEST_NPM_PID=$(ps aux | grep '[n]pm start' | awk '{print $2, $9}' | sort -k2 -n | tail -1 | awk '{print $1}')
    
    if [ -n "$LATEST_NPM_PID" ]; then
        echo "Found latest npm start process: $LATEST_NPM_PID"
        
        # npm startプロセスの子プロセスからElectronメインプロセスを探す
        ELECTRON_PID=$(pstree -p "$LATEST_NPM_PID" | grep -o 'electron([0-9]*)' | head -1 | grep -o '[0-9]*')
        
        if [ -n "$ELECTRON_PID" ]; then
            echo "Found Electron main process: $ELECTRON_PID"
            PID="$ELECTRON_PID"
        else
            echo "Electron process not found, using npm PID: $LATEST_NPM_PID"
            PID="$LATEST_NPM_PID"
        fi
    else
        # npm startが見つからない場合、Prompt LineのElectronプロセスを直接検索
        echo "npm start process not found - searching for Prompt Line Electron processes..."
        
        # 全Electronプロセスをチェックしてprompt-line関連を探す
        for pid in $(pgrep electron 2>/dev/null); do
            if [ -f "/proc/$pid/cmdline" ]; then
                CMDLINE=$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ')
                if echo "$CMDLINE" | grep -q "prompt-line.*electron"; then
                    echo "Found Prompt Line Electron process: $pid"
                    echo "Command: $CMDLINE"
                    PID="$pid"
                    break
                fi
            fi
        done
    fi
fi

if [ -n "$PID" ]; then
    echo "Sending activation signal to PID: $PID"
    # ElectronメインプロセスにSIGUSR1シグナルを送信
    if kill -USR1 $PID 2>/dev/null; then
        echo "✅ Prompt Line activation signal sent!"
        # 成功後、短時間でシグナルロックを削除
        sleep 1
        rm -f "$SIGNAL_LOCK_FILE"
    else
        echo "❌ Failed to send signal to PID: $PID"
        rm -f "$SIGNAL_LOCK_FILE"
        exit 1
    fi
else
    echo "❌ Prompt Line Electron process not found"
    echo "💡 Make sure Prompt Line is running with: npm start"
    rm -f "$SIGNAL_LOCK_FILE"
    exit 1
fi