#!/bin/bash

# Prompt Line 永続起動スクリプト
# 使用方法: ./start-prompt-line-persistent.sh

echo "🚀 Prompt Line 永続起動スクリプト"
echo "================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# WSL個別インスタンス対応 - PIDを含むユニークなロックファイル
CURRENT_PID=$$
LOCK_FILE="$SCRIPT_DIR/.prompt-line-$CURRENT_PID.lock"
LOG_FILE="$SCRIPT_DIR/prompt-line-$CURRENT_PID.log"

# WSL個別インスタンス用 - 既存プロセスチェックを無効化
check_existing_process() {
    # 個別インスタンス対応のため、重複チェックはスキップ
    echo "🌐 WSL個別インスタンスモード - 重複チェックをスキップ"
    return 1
}

# プロセス停止関数（WSL個別インスタンス対応）
stop_process() {
    local stopped_any=false
    
    # 現在のインスタンスのロックファイルをチェック
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "⏹️  現在のインスタンス (PID: $pid) を停止中..."
            kill "$pid"
            sleep 2
            if ps -p "$pid" > /dev/null 2>&1; then
                echo "🔨 強制終了中..."
                kill -9 "$pid"
            fi
            rm -f "$LOCK_FILE"
            echo "✅ インスタンス (PID: $pid) を停止しました"
            stopped_any=true
        else
            rm -f "$LOCK_FILE"
        fi
    fi
    
    # 他の全てのPrompt Lineインスタンスも停止（'all'オプション時）
    if [ "$1" = "all" ]; then
        echo "🧹 全てのPrompt Lineインスタンスを停止中..."
        local lock_files=$(find "$SCRIPT_DIR" -name ".prompt-line-*.lock" 2>/dev/null)
        
        for lock_file in $lock_files; do
            if [ -f "$lock_file" ]; then
                local pid=$(cat "$lock_file")
                if ps -p "$pid" > /dev/null 2>&1; then
                    echo "⏹️  インスタンス (PID: $pid) を停止中..."
                    kill "$pid" 2>/dev/null
                    sleep 1
                    if ps -p "$pid" > /dev/null 2>&1; then
                        kill -9 "$pid" 2>/dev/null
                    fi
                    stopped_any=true
                fi
                rm -f "$lock_file"
            fi
        done
        
        # ログファイルもクリーンアップ
        find "$SCRIPT_DIR" -name "prompt-line-*.log" -exec rm -f {} \; 2>/dev/null
    fi
    
    if [ "$stopped_any" = false ]; then
        echo "ℹ️  起動中のPrompt Lineプロセスが見つかりません"
    fi
}

# ヘルプ表示（WSL個別インスタンス対応）
show_help() {
    echo "使用方法:"
    echo "  $0 start         - Prompt Lineを起動（各WSLウィンドウで個別インスタンス）"  
    echo "  $0 stop          - 現在のインスタンスを停止"
    echo "  $0 stop all      - 全てのインスタンスを停止"
    echo "  $0 restart       - 現在のインスタンスを再起動"
    echo "  $0 status        - 現在のインスタンスの状態を確認"
    echo "  $0 status all    - 全てのインスタンスの状態を確認"
    echo "  $0 logs          - 現在のインスタンスのログを表示"
    echo ""
    echo "🌐 WSL個別インスタンスモード:"
    echo "  - 各WSLウィンドウで独立したPrompt Lineが動作"
    echo "  - WSLウィンドウを閉じると自動的にインスタンスが終了"
}

# 状態確認（WSL個別インスタンス対応）
check_status() {
    if [ "$1" = "all" ]; then
        echo "🌐 全てのPrompt Lineインスタンス状態:"
        echo "=================================="
        local found_any=false
        local lock_files=$(find "$SCRIPT_DIR" -name ".prompt-line-*.lock" 2>/dev/null)
        
        for lock_file in $lock_files; do
            if [ -f "$lock_file" ]; then
                local pid=$(cat "$lock_file")
                local instance_id=$(basename "$lock_file" .lock | sed 's/.prompt-line-//')
                if ps -p "$pid" > /dev/null 2>&1; then
                    echo "✅ インスタンス $instance_id (PID: $pid) - 動作中"
                    echo "📊 メモリ使用量: $(ps -o pid,vsz,rss,comm -p $pid | tail -1)"
                    found_any=true
                else
                    echo "❌ インスタンス $instance_id - ロックファイルのみ残存（プロセス停止）"
                    rm -f "$lock_file"
                fi
                echo ""
            fi
        done
        
        if [ "$found_any" = false ]; then
            echo "ℹ️  起動中のPrompt Lineインスタンスはありません"
        fi
    else
        # 現在のインスタンスのみチェック
        if [ -f "$LOCK_FILE" ]; then
            local pid=$(cat "$LOCK_FILE")
            if ps -p "$pid" > /dev/null 2>&1; then
                echo "✅ Prompt Lineは起動中です (PID: $pid)"
                echo "📊 メモリ使用量: $(ps -o pid,vsz,rss,comm -p $pid | tail -1)"
            else
                echo "❌ ロックファイルは存在しますが、プロセスが見つかりません"
                rm -f "$LOCK_FILE"
            fi
        else
            echo "❌ Prompt Lineは停止中です"
        fi
    fi
}

# Prompt Line起動
start_prompt_line() {
    echo "📋 起動前チェック..."
    
    # 既存プロセスチェック
    if check_existing_process; then
        return 0
    fi
    
    # Node.js/npmチェック
    if ! command -v npm >/dev/null 2>&1; then
        echo "❌ エラー: npm が見つかりません"
        exit 1
    fi
    
    echo "🔧 プロジェクトディレクトリ: $SCRIPT_DIR"
    cd "$SCRIPT_DIR"
    
    # 依存関係の確認とインストール
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/electron" ]; then
        echo "📦 依存関係をインストール中..."
        npm install || {
            echo "❌ npm install に失敗しました"
            exit 1
        }
    fi
    
    # コンパイルはnpm startに含まれるため、ここではスキップ
    echo "⚙️  準備完了..."
    
    echo "🚀 Prompt Line を起動中..."
    
    # バックグラウンドで起動（npm start使用）
    nohup npm start >> "$LOG_FILE" 2>&1 &
    local pid=$!
    
    # PIDをロックファイルに保存
    echo "$pid" > "$LOCK_FILE"
    
    # 起動確認（GPU初期化の時間を考慮して延長）
    sleep 5
    if ps -p "$pid" > /dev/null 2>&1; then
        echo "✅ Prompt Line が正常に起動しました (PID: $pid)"
        echo "📝 ログファイル: $LOG_FILE"
        echo "⌨️  使用方法: Ctrl+Alt+Space でPrompt Line起動"
        echo ""
        echo "🔍 管理コマンド:"
        echo "  停止: $0 stop"
        echo "  状態確認: $0 status"
        echo "  ログ表示: $0 logs"
    else
        echo "❌ Prompt Line の起動に失敗しました"
        rm -f "$LOCK_FILE"
        echo "📋 エラーログ:"
        tail -20 "$LOG_FILE"
        exit 1
    fi
}

# ログ表示
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo "📊 Prompt Line ログ (最新20行):"
        echo "==============================="
        tail -20 "$LOG_FILE"
        echo ""
        echo "💡 リアルタイムログ: tail -f $LOG_FILE"
    else
        echo "📋 ログファイルが見つかりません: $LOG_FILE"
    fi
}

# メイン処理
case "${1:-start}" in
    start)
        start_prompt_line
        ;;
    stop)
        stop_process "$2"
        ;;;
    restart)
        stop_process
        sleep 1
        start_prompt_line
        ;;
    status)
        check_status "$2"
        ;;;
    logs)
        show_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ 無効なオプション: $1"
        show_help
        exit 1
        ;;
esac