#!/bin/bash
# Start Open WebUI on port 3001
# Usage: ./scripts/start_open_webui.sh [--port PORT] [--detach]

set -e

# Parse arguments
PORT="3001"
DETACH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --detach)
            DETACH=true
            shift
            ;;
        *)
            # Legacy: first positional arg is port
            if [[ "$1" =~ ^[0-9]+$ ]]; then
                PORT="$1"
            fi
            shift
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Open WebUI Launcher ===${NC}"
echo -e "${YELLOW}Port: ${PORT}${NC}"

# Check if port is already in use
if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    echo -e "${RED}Error: Port ${PORT} is already in use${NC}"
    ss -tlnp | grep ":${PORT} "
    exit 1
fi

# Configuration
OPEN_WEBUI_DIR="$HOME/.local/share/open-webui"
VENV_DIR="$OPEN_WEBUI_DIR/venv"
DATA_DIR="$OPEN_WEBUI_DIR/data"

# Create data directory
mkdir -p "$DATA_DIR"

# Check if venv exists
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv "$VENV_DIR"
fi

# Activate venv and install open-webui if needed
source "$VENV_DIR/bin/activate"

if ! pip show open-webui &>/dev/null; then
    echo -e "${YELLOW}Installing Open WebUI... (this may take a few minutes)${NC}"
    pip install open-webui
fi

# Set environment variables for ZeroClaw integration
export OPENAI_API_BASE_URL="http://127.0.0.1:42618/v1"
export OPENAI_API_KEY="zeroclaw-pairing-token"
export DATA_DIR="$DATA_DIR"
export PORT="$PORT"
export HOST="0.0.0.0"  # Listen on all interfaces for reverse proxy

echo -e "${GREEN}Starting Open WebUI on http://127.0.0.1:${PORT}${NC}"
echo -e "${YELLOW}ZeroClaw API configured at: http://127.0.0.1:42618/v1${NC}"
echo ""
echo -e "Press Ctrl+C to stop"
echo ""

# Start Open WebUI
if [ "$DETACH" = true ]; then
    nohup open-webui serve --host "$HOST" --port "$PORT" > "$OPEN_WEBUI_DIR/open-webui.log" 2>&1 &
    echo $! > "$OPEN_WEBUI_DIR/open-webui.pid"
    echo -e "${GREEN}Open WebUI started in background (PID: $(cat $OPEN_WEBUI_DIR/open-webui.pid))${NC}"
    echo -e "Logs: $OPEN_WEBUI_DIR/open-webui.log"
else
    open-webui serve --host "$HOST" --port "$PORT"
fi
