#!/usr/bin/env bash
#===============================================================================
# devkitx/ralphy/main.sh - Main Integration for Ralphy in DevKitX
#
# Provides the main entry point and integration hooks for Ralphy
# compatibility fixes in the DevKitX workflow.
#===============================================================================

#-------------------------------------------------------------------------------
# Global Configuration
#-------------------------------------------------------------------------------

RALPHY_MAIN_VERSION="1.0.0"
RALPHY_MAIN_LOG_PREFIX="[ralphy:main]"

# Configuration (can be overridden by environment)
RALPHY_AUTO_FIX="${RALPHY_AUTO_FIX:-true}"
RALPHY_AUTO_FIX_ONCE="${RALPHY_AUTO_FIX_ONCE:-true}"
RALPHY_FIXES_APPLIED_FILE="${RALPHY_FIXES_APPLIED_FILE:-./.ralphy/msys2-fixes-applied.flag}"

#-------------------------------------------------------------------------------
# Logging Functions
#-------------------------------------------------------------------------------

ralphy_main_log_info() {
    echo "${RALPHY_MAIN_LOG_PREFIX}[INFO] $*" >&2
}

ralphy_main_log_warn() {
    echo "${RALPHY_MAIN_LOG_PREFIX}[WARN] $*" >&2
}

ralphy_main_log_error() {
    echo "${RALPHY_MAIN_LOG_PREFIX}[ERROR] $*" >&2
}

ralphy_main_log_debug() {
    if [[ "${RALPHY_DEBUG:-false}" == "true" ]]; then
        echo "${RALPHY_MAIN_LOG_PREFIX}[DEBUG] $*" >&2
    fi
}

#-------------------------------------------------------------------------------
# Source Dependencies
#-------------------------------------------------------------------------------

# Source core detection functions
ralphy_main_load_detect() {
    local detect_script
    
    # Try to find detect.sh in standard locations
    for detect_script in \
        "$(dirname "$0")/../core/detect.sh" \
        "$(dirname "$0")/../../core/detect.sh" \
        "./src/core/detect.sh" \
        "$HOME/.devkitx/core/detect.sh"; do
        if [[ -f "$detect_script" ]]; then
            # shellcheck source=../core/detect.sh
            . "$detect_script"
            ralphy_main_log_debug "Loaded detect.sh from: $detect_script"
            return 0
        fi
    done
    
    ralphy_main_log_warn "Could not find detect.sh, MSYS2 detection may not work"
    return 1
}

# Source fixes functions
ralphy_main_load_fixes() {
    local fixes_script
    
    # Try to find fixes.sh in standard locations
    for fixes_script in \
        "$(dirname "$0")/fixes.sh" \
        "$(dirname "$0")/../../ralphy/fixes.sh" \
        "./src/ralphy/fixes.sh" \
        "$HOME/.devkitx/ralphy/fixes.sh"; do
        if [[ -f "$fixes_script" ]]; then
            # shellcheck source=fixes.sh
            . "$fixes_script"
            ralphy_main_log_debug "Loaded fixes.sh from: $fixes_script"
            return 0
        fi
    done
    
    ralphy_main_log_warn "Could not find fixes.sh, MSYS2 fixes may not work"
    return 1
}

#-------------------------------------------------------------------------------
# Fix Tracking
#-------------------------------------------------------------------------------

# Check if fixes have already been applied
ralphy_main_fixes_already_applied() {
    local project_root="${1:-$(pwd)}"
    local flag_file="$project_root/$RALPHY_FIXES_APPLIED_FILE"
    
    if [[ -f "$flag_file" ]]; then
        ralphy_main_log_debug "Fixes already applied (flag file exists)"
        return 0
    fi
    
    return 1
}

# Mark fixes as applied
ralphy_main_mark_fixes_applied() {
    local project_root="${1:-$(pwd)}"
    local flag_file="$project_root/$RALPHY_FIXES_APPLIED_FILE"
    local ralphy_file="$project_root/.ralph/ralphy.sh"
    
    # Create flag file with metadata
    {
        echo "# MSYS2 compatibility fixes applied by DevKitX"
        echo "# Date: $(date -Iseconds)"
        echo "# Ralphy file: $ralphy_file"
        echo ""
        echo "RALPHY_FILE='$ralphy_file'"
        echo "APPLIED_DATE='$(date -Iseconds)'"
        echo "APPLIED_BY='DevKitX Ralphy Integration'"
    } > "$flag_file"
    
    ralphy_main_log_debug "Marked fixes as applied: $flag_file"
}

#-------------------------------------------------------------------------------
# MSYS2 Compatibility Application
#-------------------------------------------------------------------------------

# Apply MSYS2 compatibility fixes
#
# Arguments:
#   $1 - Project root directory (default: current directory)
#   $2 - Ralphy file path (default: project_root/.ralph/ralphy.sh)
#
# Returns:
#   0 on success, 1 on error or if fixes not needed
apply_msys2_compatibility_fixes() {
    local project_root="${1:-$(pwd)}"
    local ralphy_file="${2:-$project_root/.ralph/ralphy.sh}"
    local applied=false
    
    # Check if auto-fix is enabled
    if [[ "$RALPHY_AUTO_FIX" != "true" ]]; then
        ralphy_main_log_info "Auto-fix disabled (RALPHY_AUTO_FIX=false)"
        return 1
    fi
    
    # Check if MSYS2 environment
    if ! command -v detect_msys2_environment >/dev/null 2>&1; then
        ralphy_main_load_detect || true
    fi
    
    if command -v detect_msys2_environment >/dev/null 2>&1; then
        if ! detect_msys2_environment; then
            ralphy_main_log_debug "Not running in MSYS2 environment"
            return 1
        fi
    fi
    
    # Check if fixes already applied
    if [[ "$RALPHY_AUTO_FIX_ONCE" == "true" ]]; then
        if ralphy_main_fixes_already_applied "$project_root"; then
            ralphy_main_log_debug "Fixes already applied, skipping"
            return 1
        fi
    fi
    
    # Check if ralphy file exists
    if [[ ! -f "$ralphy_file" ]]; then
        ralphy_main_log_warn "ralphy.sh not found at: $ralphy_file"
        ralphy_main_log_info "Please ensure Ralphy is installed in the project"
        return 1
    fi
    
    # Display banner
    cat << 'EOF'

============================================
⚠️  MSYS2 Environment Detected
============================================

Applying Windows MSYS2/Git Bash compatibility
fixes for Ralphy...

EOF
    
    # Load fixes functions
    if ! command -v fix_ralphy_for_msys2 >/dev/null 2>&1; then
        ralphy_main_load_fixes || {
            ralphy_main_log_error "Failed to load fixes.sh"
            return 1
        }
    fi
    
    # Apply fixes
    if fix_ralphy_for_msys2 "$ralphy_file"; then
        ralphy_main_log_info "MSYS2 compatibility fixes applied successfully"
        
        # Mark as applied
        ralphy_main_mark_fixes_applied "$project_root"
        
        # Display success message
        cat << 'EOF'

✅ Compatibility fixes applied successfully!

The following issues were fixed:
  1. command -v checks wrapped in subshells
  2. Arithmetic operations with || true
  3. Strict mode (set -euo pipefail) disabled

You may now run Ralphy normally.

============================================

EOF
        
        applied=true
    else
        ralphy_main_log_warn "Failed to apply some or all fixes"
        cat << 'EOF'

⚠️  Some fixes may not have been applied.

If you encounter issues, please check:
  - File permissions
  - Backup files in .ralphy-backups/
  - Manual fixes in the ralphy.sh file

============================================

EOF
    fi
    
    if $applied; then
        return 0
    else
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Help and Usage
#-------------------------------------------------------------------------------

# Display MSYS2 compatibility help
ralphy_main_help() {
    cat << EOF
DevKitX Ralphy Integration - MSYS2 Compatibility Help
=====================================================

Commands:
  apply               Apply MSYS2 compatibility fixes
  status              Check if fixes have been applied
  check               Check for MSYS2 issues
  help                Show this help message

Environment Variables:
  RALPHY_AUTO_FIX     Enable auto-fix (default: true)
  RALPHY_AUTO_FIX_ONCE Only apply once (default: true)
  RALPHY_DEBUG        Enable debug output (default: false)

Usage:
  # Apply fixes to current project
  source main.sh && apply_msys2_compatibility_fixes

  # Check for issues without fixing
  source main.sh && fixes_check_patterns ./ralphy.sh

  # Run with dry-run to preview
  source main.sh && fix_ralphy_for_msys2 ./ralphy.sh dry-run

For more information, see:
  docs/msys2-compatibility.md

EOF
}

#-------------------------------------------------------------------------------
# Integration Hooks
#-------------------------------------------------------------------------------

# Integration hook for dx ralph run command
ralphy_main_integrate_with_run() {
    local project_root="${1:-$(pwd)}"
    
    # Apply fixes before running ralphy
    apply_msys2_compatibility_fixes "$project_root"
}

# Integration hook for project initialization
ralphy_main_integrate_with_init() {
    local project_root="${1:-$(pwd)}"
    local ralphy_file="$project_root/.ralph/ralphy.sh"
    
    # If ralphy.sh exists and we're in MSYS2, apply fixes
    if [[ -f "$ralphy_file" ]]; then
        apply_msys2_compatibility_fixes "$project_root"
    fi
}

#-------------------------------------------------------------------------------
# Main Entry Point
#----------------------------------------------------------------------------===

# Display usage information
ralphy_main_usage() {
    cat << EOF
DevKitX Ralphy Integration v${RALPHY_MAIN_VERSION}

Usage: source main.sh [command]

Commands:
  apply               Apply MSYS2 compatibility fixes
  status              Check fix application status
  check               Check for MSYS2 issues in ralphy.sh
  help                Show help message

Options:
  --verbose, -v       Verbose output
  --help, -h          Show help

Examples:
  # Apply fixes
  cd /path/to/project
  source main.sh apply

  # Check status
  source main.sh status

  # Load functions without applying
  source main.sh

EOF
}

# Main entry point for CLI usage
ralphy_main_main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        apply)
            apply_msys2_compatibility_fixes "$1"
            ;;
        status)
            if ralphy_main_fixes_already_applied "$1"; then
                echo "MSYS2 fixes have been applied"
                return 0
            else
                echo "MSYS2 fixes have NOT been applied"
                return 1
            fi
            ;;
        check)
            # Load fixes and check
            ralphy_main_load_fixes
            fixes_check_patterns "${1:-./ralphy.sh}"
            ;;
        help|--help|-h)
            ralphy_main_usage
            ;;
        *)
            ralphy_main_usage
            return 1
            ;;
    esac
}

# Run main if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    ralphy_main_main "$@"
fi

# Export functions for sourcing
export -f ralphy_main_log_info ralphy_main_log_warn ralphy_main_log_error ralphy_main_log_debug
export -f ralphy_main_load_detect ralphy_main_load_fixes
export -f ralphy_main_fixes_already_applied ralphy_main_mark_fixes_applied
export -f apply_msys2_compatibility_fixes
export -f ralphy_main_help ralphy_main_usage ralphy_main_main
export -f ralphy_main_integrate_with_run ralphy_main_integrate_with_init

# Export version
export RALPHY_MAIN_VERSION
