#!/bin/bash

# UFW Configuration Script for ZeroClaw
# Configures firewall rules to secure the ZeroClaw API and system

set -e

# Color output definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root or with sudo"
    exit 1
fi

# Check if UFW is installed
if ! command -v ufw &> /dev/null; then
    print_error "UFW is not installed. Please install it first:"
    echo "  sudo apt-get update && sudo apt-get install -y ufw"
    exit 1
fi

# Parse command line arguments
SKIP_RESET=false
for arg in "$@"; do
    case $arg in
        --skip-reset)
            SKIP_RESET=true
            shift
            ;;
        *)
            ;;
    esac
done

print_info "Starting UFW configuration..."
echo ""

# Reset UFW rules if not skipped
if [ "$SKIP_RESET" = false ]; then
    print_warn "Resetting UFW rules..."
    ufw --force reset
    print_info "UFW rules reset complete"
else
    print_info "Skipping UFW reset (--skip-reset flag set)"
fi
echo ""

# Set default policies
# Deny all incoming connections by default
print_info "Setting default policies..."
ufw default deny incoming
# Allow all outgoing connections by default
ufw default allow outgoing
print_info "Default policies configured: deny incoming, allow outgoing"
echo ""

# Allow SSH to prevent lockout
# Always allow SSH on port 22 to maintain remote access
print_info "Allowing SSH (port 22)..."
ufw allow 22/tcp comment 'Allow SSH access'
echo ""

# Limit ZeroClaw API access with rate limiting
# Use 'limit' to restrict connections and prevent brute force attacks
print_info "Limiting ZeroClaw API (port 42617) with rate limiting..."
ufw limit 42617/tcp comment 'ZeroClaw API with rate limiting'
echo ""

# Allow localhost access
print_info "Allowing localhost access..."
ufw allow from 127.0.0.1
ufw allow from ::1
echo ""

# Enable logging
# Medium level logs login, logins with no user, and logins with invalid user
print_info "Enabling UFW logging (medium)..."
ufw logging medium
echo ""

# Enable the firewall
print_info "Enabling UFW firewall..."
ufw --force enable
echo ""

# Show status
print_info "UFW configuration complete!"
echo ""
print_info "Current UFW status (numbered rules):"
ufw status numbered
echo ""

print_info "UFW has been configured successfully!"
print_warn "Important: Ensure you can still access your server via SSH before closing this session."
