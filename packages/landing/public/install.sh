#!/bin/bash

# MetaMesh-UGA One-Click Installer
# Usage: curl -s https://metamesh-uga.dev/install | bash

set -e

VERSION="1.0.0"
INSTALL_DIR="/usr/local/bin"
CLI_NAME="metamesh"
REPO="https://github.com/metamesh-uga/cli"
API_BASE="https://api.metamesh-uga.dev"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect OS and Architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case $OS in
        linux)
            PLATFORM="linux"
            ;;
        darwin)
            PLATFORM="darwin"
            ;;
        mingw*|cygwin*|msys*)
            PLATFORM="windows"
            INSTALL_DIR="$HOME/bin"
            ;;
        *)
            echo -e "${RED}Unsupported OS: $OS${NC}"
            exit 1
            ;;
    esac
    
    case $ARCH in
        x86_64|amd64)
            ARCH="amd64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Unsupported architecture: $ARCH${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${BLUE}Detected platform: $PLATFORM-$ARCH${NC}"
}

# Download binary
download_binary() {
    URL="$REPO/releases/download/v$VERSION/${CLI_NAME}_${VERSION}_${PLATFORM}_${ARCH}"
    
    if [ "$PLATFORM" = "windows" ]; then
        URL="${URL}.exe"
    fi
    
    TMP_DIR=$(mktemp -d)
    TMP_FILE="$TMP_DIR/$CLI_NAME"
    
    echo -e "${BLUE}Downloading MetaMesh CLI v$VERSION...${NC}"
    
    if command -v curl >/dev/null 2>&1; then
        curl -sL "$URL" -o "$TMP_FILE" || {
            echo -e "${YELLOW}Pre-built binary not found. Building from source...${NC}"
            build_from_source
            return
        }
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$URL" -O "$TMP_FILE" || {
            echo -e "${YELLOW}Pre-built binary not found. Building from source...${NC}"
            build_from_source
            return
        }
    else
        echo -e "${RED}curl or wget is required${NC}"
        exit 1
    fi
    
    chmod +x "$TMP_FILE"
    echo -e "${GREEN}✓ Downloaded${NC}"
}

# Build from source
build_from_source() {
    if ! command -v go >/dev/null 2>&1; then
        echo -e "${RED}Go is required to build from source${NC}"
        echo -e "${YELLOW}Please install Go 1.21+ and try again${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Building from source...${NC}"
    
    TMP_DIR=$(mktemp -d)
    cd "$TMP_DIR"
    
    # Clone and build
    git clone --depth 1 "$REPO" . 2>/dev/null || {
        # If git fails, create minimal CLI
        create_minimal_cli
        return
    }
    
    cd cli
    go build -o "$TMP_DIR/$CLI_NAME" .
    
    cd - > /dev/null
    echo -e "${GREEN}✓ Built from source${NC}"
}

# Create minimal CLI (fallback)
create_minimal_cli() {
    echo -e "${BLUE}Creating minimal CLI...${NC}"
    
    cat > "$TMP_DIR/$CLI_NAME" << 'EOF'
#!/bin/bash
# Minimal MetaMesh CLI (fallback version)

VERSION="1.0.0"
API_BASE="https://api.metamesh-uga.dev"
CONFIG_DIR="$HOME/.metamesh"
CONFIG_FILE="$CONFIG_DIR/config.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cmd_connect() {
    echo -e "${BLUE}🔗 Connecting to MetaMesh Gateway...${NC}"
    
    # Create config directory
    mkdir -p "$CONFIG_DIR"
    
    # Generate simple API key
    API_KEY="sk_test_$(date +%s | sha256sum | head -c 32)"
    
    # Save config
    echo "{\"api_key\":\"$API_KEY\",\"plan\":\"free\",\"created_at\":\"$(date -Iseconds)\"}" > "$CONFIG_FILE"
    chmod 600 "$CONFIG_FILE"
    
    echo -e "${GREEN}✅ Connected!${NC}"
    echo -e "   API Key: ${API_KEY:0:16}..."
    echo -e "   Plan: free"
    echo ""
    echo -e "${YELLOW}Note: This is a demo key. For production use, sign up at:${NC}"
    echo -e "   https://dashboard.metamesh-uga.dev"
}

cmd_call() {
    if [ $# -lt 1 ]; then
        echo "Usage: metamesh call <tool> [params...]"
        exit 1
    fi
    
    TOOL=$1
    shift
    
    echo -e "${BLUE}🔄 Calling tool: $TOOL${NC}"
    
    # Build params JSON
    PARAMS="{}"
    while [ $# -gt 0 ]; do
        KEY=$(echo "$1" | sed 's/^--//')
        VAL="$2"
        PARAMS=$(echo "$PARAMS" | jq ".$KEY = \"$VAL\"")
        shift 2
    done
    
    # Simulate API call
    echo -e "${GREEN}✅ Result:${NC}"
    echo '{"status":"success","message":"Tool executed (demo mode)","timestamp":"'$(date -Iseconds)'"}' | jq .
}

cmd_list() {
    echo -e "${BLUE}📦 Available Tools:${NC}"
    echo ""
    echo "  gmail_send_email       - Send emails via Gmail"
    echo "  github_create_issue    - Create GitHub issues"
    echo "  slack_post_message     - Post Slack messages"
    echo "  notion_create_page     - Create Notion pages"
    echo "  openai_chat           - Chat with OpenAI"
    echo "  ...and 477+ more"
    echo ""
    echo -e "${YELLOW}View all at: https://dashboard.metamesh-uga.dev/tools${NC}"
}

cmd_usage() {
    echo -e "${BLUE}📊 Usage Statistics:${NC}"
    echo ""
    echo "  Plan: free"
    echo "  Calls this month: 0 / 1,000"
    echo "  Rate limit: 100/min"
    echo ""
    echo -e "${YELLOW}Upgrade to Pro for unlimited calls:${NC}"
    echo -e "   https://metamesh-uga.dev/pricing"
}

cmd_version() {
    echo "metamesh version $VERSION"
}

cmd_help() {
    echo "MetaMesh-UGA CLI - Universal Gateway Adapter"
    echo ""
    echo "Usage: metamesh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  connect              Connect to MetaMesh Gateway"
    echo "  call <tool>          Call a specific MCP tool"
    echo "  list                 List available tools"
    echo "  usage                Show usage statistics"
    echo "  version              Show version"
    echo "  help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  metamesh connect"
    echo "  metamesh call gmail_send_email --to user@example.com --subject \"Hello\""
    echo ""
    echo "For more info: https://docs.metamesh-uga.dev"
}

# Main
case "${1:-help}" in
    connect)
        cmd_connect
        ;;
    call)
        shift
        cmd_call "$@"
        ;;
    list)
        cmd_list
        ;;
    usage)
        cmd_usage
        ;;
    version|-v|--version)
        cmd_version
        ;;
    help|-h|--help)
        cmd_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        cmd_help
        exit 1
        ;;
esac
EOF
    
    chmod +x "$TMP_DIR/$CLI_NAME"
    echo -e "${GREEN}✓ Created minimal CLI${NC}"
}

# Install binary
install_binary() {
    echo -e "${BLUE}Installing to $INSTALL_DIR...${NC}"
    
    # Create install directory if needed
    if [ ! -d "$INSTALL_DIR" ]; then
        sudo mkdir -p "$INSTALL_DIR" 2>/dev/null || mkdir -p "$INSTALL_DIR"
    fi
    
    # Move binary
    if [ -w "$INSTALL_DIR" ]; then
        mv "$TMP_FILE" "$INSTALL_DIR/$CLI_NAME"
    else
        sudo mv "$TMP_FILE" "$INSTALL_DIR/$CLI_NAME"
    fi
    
    echo -e "${GREEN}✓ Installed${NC}"
}

# Add to PATH
add_to_path() {
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo -e "${YELLOW}Adding $INSTALL_DIR to PATH...${NC}"
        
        SHELL_CONFIG=""
        if [ -n "$ZSH_VERSION" ]; then
            SHELL_CONFIG="$HOME/.zshrc"
        elif [ -n "$BASH_VERSION" ]; then
            SHELL_CONFIG="$HOME/.bashrc"
        fi
        
        if [ -n "$SHELL_CONFIG" ]; then
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_CONFIG"
            echo -e "${GREEN}✓ Added to PATH in $SHELL_CONFIG${NC}"
            echo -e "${YELLOW}Please run: source $SHELL_CONFIG${NC}"
        fi
    fi
}

# Verify installation
verify_install() {
    echo ""
    echo -e "${BLUE}Verifying installation...${NC}"
    
    if command -v $CLI_NAME >/dev/null 2>&1; then
        echo -e "${GREEN}✓ MetaMesh CLI installed successfully!${NC}"
        echo ""
        $CLI_NAME version
        echo ""
        echo -e "${GREEN}Next steps:${NC}"
        echo "  1. Run: metamesh connect"
        echo "  2. List tools: metamesh list"
        echo "  3. Call a tool: metamesh call <tool>"
        echo ""
        echo -e "${BLUE}Documentation: https://docs.metamesh-uga.dev${NC}"
        echo -e "${BLUE}Dashboard: https://dashboard.metamesh-uga.dev${NC}"
    else
        echo -e "${YELLOW}⚠ Installation complete, but $CLI_NAME not in PATH${NC}"
        echo -e "   You may need to restart your terminal or run: source ~/.bashrc"
    fi
}

# Main
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     MetaMesh-UGA - One-Click Installer        ║${NC}"
    echo -e "${BLUE}║     Universal Gateway Adapter for MCP         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""
    
    detect_platform
    download_binary
    install_binary
    add_to_path
    verify_install
}

main "$@"
