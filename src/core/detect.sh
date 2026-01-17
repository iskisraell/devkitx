#!/usr/bin/env bash
#===============================================================================
# devkitx/core/detect.sh - Environment Detection for DevKitX
#
# Provides functions to detect the current environment including MSYS2,
# WSL, Docker, and other special environments.
#===============================================================================

#-------------------------------------------------------------------------------
# Global Configuration
#-------------------------------------------------------------------------------

DETECT_SCRIPT_VERSION="1.0.0"
DETECT_LOG_PREFIX="[detect]"

#-------------------------------------------------------------------------------
# Logging Functions
#-------------------------------------------------------------------------------

detect_log_info() {
    echo "${DETECT_LOG_PREFIX}[INFO] $*" >&2
}

detect_log_warn() {
    echo "${DETECT_LOG_PREFIX}[WARN] $*" >&2
}

detect_log_error() {
    echo "${DETECT_LOG_PREFIX}[ERROR] $*" >&2
}

detect_log_debug() {
    if [[ "${DETECT_DEBUG:-false}" == "true" ]]; then
        echo "${DETECT_LOG_PREFIX}[DEBUG] $*" >&2
    fi
}

#-------------------------------------------------------------------------------
# OS Detection
#-------------------------------------------------------------------------------

# Detect the operating system
# Returns: "linux", "macos", "windows", or "unknown"
detect_os() {
    local os="unknown"
    
    case "$(uname -s)" in
        Linux*)
            os="linux"
            ;;
        Darwin*)
            os="macos"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            os="windows"
            ;;
        *)
            os="unknown"
            ;;
    esac
    
    echo "$os"
    return 0
}

# Detect if running on Windows (any variant)
detect_is_windows() {
    local os
    os=$(detect_os)
    [[ "$os" == "windows" ]]
}

# Detect if running on WSL (Windows Subsystem for Linux)
detect_is_wsl() {
    local is_wsl=false
    
    # Check for WSL-specific files
    if [[ -f /proc/version ]]; then
        if grep -qi "microsoft" /proc/version 2>/dev/null; then
            is_wsl=true
        fi
    fi
    
    # Check for WSL environment variable
    if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
        is_wsl=true
    fi
    
    # Check for WSL_INTEROP environment variable
    if [[ -n "${WSL_INTEROP:-}" ]]; then
        is_wsl=true
    fi
    
    # Check if /mnt/c exists (WSL mounts Windows drives)
    if [[ -d /mnt/c ]] && [[ "$is_wsl" == "false" ]]; then
        # Additional check - WSL typically has these mounts
        if detect_is_windows && [[ -d /mnt ]]; then
            is_wsl=true
        fi
    fi
    
    $is_wsl
}

#-------------------------------------------------------------------------------
# MSYS2 Detection (Critical for Windows Git Bash compatibility)
#-------------------------------------------------------------------------------

# Detect if running in MSYS2 environment
# This is critical for Ralphy compatibility on Windows
# Returns: 0 (true) if MSYS2 detected, 1 (false) otherwise
detect_msys2_environment() {
    local msystem="${MSYSTEM:-}"
    local ostype="${OSTYPE:-}"
    local bash_path=""
    
    detect_log_debug "Checking for MSYS2 environment..."
    detect_log_debug "  MSYSTEM='$msystem'"
    detect_log_debug "  OSTYPE='$ostype'"
    
    # Primary check: MSYSTEM environment variable
    # MSYS2 sets this to values like "MSYS", "MINGW64", "MINGW32", etc.
    if [[ -n "$msystem" ]]; then
        detect_log_debug "  MSYSTEM is set, MSYS2 detected"
        return 0
    fi
    
    # Secondary check: OSTYPE contains "msys"
    if [[ "$ostype" == "msys" ]]; then
        detect_log_debug "  OSTYPE is 'msys', MSYS2 detected"
        return 0
    fi
    
    # Tertiary check: bash location and Windows-specific paths
    if command -v bash >/dev/null 2>&1; then
        bash_path=$(command -v bash 2>/dev/null || echo "")
        detect_log_debug "  bash found at: $bash_path"
        
        # Check for Git for Windows / MSYS2 bash locations
        if [[ "$bash_path" == *"/usr/bin/bash" ]] || \
           [[ "$bash_path" == *"/bin/bash" ]]; then
            # Additional Windows-specific checks
            if [[ -d "/c/Program Files/Git" ]] || \
               [[ -d "/c/Program Files (x86)/Git" ]] || \
               [[ -d "/c/Windows/System32" ]]; then
                detect_log_debug "  Windows paths detected with MSYS2 bash"
                return 0
            fi
        fi
    fi
    
    # Check for Windows-specific paths in current environment
    if [[ -d "/c" ]] || [[ -d "/d" ]]; then
        # MSYS2 uses /c, /d, etc. for Windows drives
        detect_log_debug "  MSYS2 drive mount detected"
        return 0
    fi
    
    # Check for .sh file associations or executable extensions
    if [[ -n "${PATHEXT:-}" ]]; then
        if [[ "$PATHEXT" == *".SH"* ]]; then
            detect_log_debug "  .SH in PATHEXT, likely Windows"
            return 0
        fi
    fi
    
    detect_log_debug "  No MSYS2 indicators found"
    return 1
}

# Detect MSYS2 and get version info
detect_msys2_version() {
    if ! detect_msys2_environment; then
        echo ""
        return 1
    fi
    
    local version=""
    
    # Try to get MSYS2 version
    if command -v pacman >/dev/null 2>&1; then
        version=$(pacman -Qs msys2-runtime 2>/dev/null | head -1 || echo "")
    fi
    
    # Also check MSYSTEM for variant info
    local msystem="${MSYSTEM:-}"
    
    if [[ -n "$version" ]]; then
        echo "$version ($msystem)"
    else
        echo "MSYS2 ($msystem)"
    fi
    
    return 0
}

# Get detailed MSYS2 environment info
detect_msys2_info() {
    local info=""
    
    if ! detect_msys2_environment; then
        echo "Not running in MSYS2 environment"
        return 1
    fi
    
    info="MSYS2 Environment Information:"
    info="$info\n  MSYSTEM: ${MSYSTEM:-not set}"
    info="$info\n  OSTYPE: ${OSTYPE:-not set}"
    info="$info\n  BASH_VERSION: ${BASH_VERSION:-not set}"
    info="$info\n  User: $(whoami 2>/dev/null || echo 'unknown')"
    info="$info\n  Home: ${HOME:-not set}"
    info="$info\n  Temp: ${TEMP:-${TMP:-not set}}"
    
    if command -v bash >/dev/null 2>&1; then
        info="$info\n  Bash location: $(command -v bash)"
    fi
    
    echo -e "$info"
    return 0
}

#-------------------------------------------------------------------------------
# Shell Detection
#-------------------------------------------------------------------------------

# Detect the current shell
detect_shell() {
    local shell=""
    
    if [[ -n "${SHELL:-}" ]]; then
        shell="$SHELL"
    elif [[ -n "${BASH_VERSION:-}" ]]; then
        shell="bash"
    elif [[ -n "${ZSH_VERSION:-}" ]]; then
        shell="zsh"
    elif [[ -n "${fish_version:-}" ]]; then
        shell="fish"
    else
        shell=$(ps -p $$ -o comm= 2>/dev/null || echo "unknown")
    fi
    
    # Extract basename
    shell="${shell##*/}"
    echo "$shell"
}

# Detect bash version if running bash
detect_bash_version() {
    if [[ -n "${BASH_VERSION:-}" ]]; then
        echo "$BASH_VERSION"
        return 0
    fi
    
    if command -v bash >/dev/null 2>&1; then
        bash --version | head -1 || echo "unknown"
        return 0
    fi
    
    echo "not bash"
    return 1
}

#-------------------------------------------------------------------------------
# Environment Summary
#-------------------------------------------------------------------------------

# Print full environment detection summary
detect_environment_summary() {
    local os shell bash_ver msys2_info
    
    os=$(detect_os)
    shell=$(detect_shell)
    bash_ver=$(detect_bash_version)
    
    echo "=============================================="
    echo "  DevKitX Environment Detection Summary"
    echo "=============================================="
    echo ""
    echo "  OS:           $os"
    echo "  Shell:        $shell"
    echo "  Bash Version: $bash_ver"
    
    if detect_msys2_environment; then
        echo "  MSYS2:        YES"
        msys2_info=$(detect_msys2_version)
        echo "  MSYS2 Info:   $msys2_info"
    else
        echo "  MSYS2:        NO"
    fi
    
    if detect_is_wsl; then
        echo "  WSL:          YES"
    else
        echo "  WSL:          NO"
    fi
    
    echo ""
    echo "=============================================="
}

# Export functions for sourcing
export -f detect_os detect_is_windows detect_is_wsl
export -f detect_msys2_environment detect_msys2_version detect_msys2_info
export -f detect_shell detect_bash_version
export -f detect_environment_summary
export -f detect_log_info detect_log_warn detect_log_error detect_log_debug

# Export version
export DETECT_SCRIPT_VERSION
