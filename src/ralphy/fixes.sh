#!/usr/bin/env bash
#===============================================================================
# devkitx/ralphy/fixes.sh - MSYS2 Compatibility Fixes for Ralphy
#
# Provides automatic detection and fixing of MSYS2 compatibility issues
# in Ralphy scripts. Handles strict bash mode incompatibilities.
#
# Issues Fixed:
# 1. command -v checks that fail with set -euo pipefail
# 2. Arithmetic operations that return exit code 1
# 3. Strict mode incompatibilities
#===============================================================================

#-------------------------------------------------------------------------------
# Global Configuration
#-------------------------------------------------------------------------------

FIXES_SCRIPT_VERSION="2.0.0"
FIXES_LOG_PREFIX="[fixes]"
FIXES_BACKUP_DIR="${FIXES_BACKUP_DIR:-./.ralphy-backups}"

#-------------------------------------------------------------------------------
# Logging Functions
#-------------------------------------------------------------------------------

fixes_log_info() {
    echo "${FIXES_LOG_PREFIX}[INFO] $*" >&2
}

fixes_log_warn() {
    echo "${FIXES_LOG_PREFIX}[WARN] $*" >&2
}

fixes_log_error() {
    echo "${FIXES_LOG_PREFIX}[ERROR] $*" >&2
}

fixes_log_debug() {
    if [[ "${FIXES_DEBUG:-false}" == "true" ]]; then
        echo "${FIXES_LOG_PREFIX}[DEBUG] $*" >&2
    fi
}

#-------------------------------------------------------------------------------
# Backup Management
#-------------------------------------------------------------------------------

fixes_create_backup() {
    local file="$1"
    local backup_file=""
    local timestamp
    
    if [[ ! -f "$file" ]]; then
        fixes_log_error "Cannot backup non-existent file: $file"
        return 1
    fi
    
    mkdir -p "$FIXES_BACKUP_DIR" 2>/dev/null || {
        FIXES_BACKUP_DIR="$(dirname "$file")"
    }
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="${file}.bak.${timestamp}"
    
    if cp "$file" "$backup_file" 2>/dev/null; then
        fixes_log_debug "Created backup: $backup_file"
        echo "$backup_file"
        return 0
    else
        fixes_log_error "Failed to create backup of: $file"
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Fix Application - Simple and Safe Approach
#-------------------------------------------------------------------------------

# Apply MSYS2 compatibility fixes to a ralphy.sh file
#
# This function uses a simple, safe approach:
# 1. Comment out 'set -euo pipefail' directive
# 2. This allows the script to run without strict error handling
#    which is the main source of MSYS2 compatibility issues
fix_ralphy_for_msys2() {
    local ralphy_file="$1"
    local dry_run="${2:-}"
    local fixed_count=0
    
    if [[ -z "$ralphy_file" ]]; then
        fixes_log_error "No ralphy file specified"
        return 1
    fi
    
    if [[ ! -f "$ralphy_file" ]]; then
        fixes_log_error "ralphy_file not found: $ralphy_file"
        return 1
    fi
    
    fixes_log_info "Processing: $ralphy_file"
    
    if [[ "$dry_run" == "dry-run" ]]; then
        fixes_log_info "  [DRY-RUN] Preview mode - no changes will be made"
    else
        backup_file=$(fixes_create_backup "$ralphy_file")
        if [[ -z "$backup_file" ]]; then
            fixes_log_error "Failed to create backup, aborting"
            return 1
        fi
    fi
    
    # --- Fix: Comment out strict mode directive ---
    # This is the main source of MSYS2 issues
    # 'set -euo pipefail' causes script to exit on any error
    
    local pattern3_count
    pattern3_count=$(grep -c '^set -euo pipefail$' "$ralphy_file" 2>/dev/null || echo "0")
    
    if [[ "$pattern3_count" -gt 0 ]]; then
        fixes_log_info "  Found strict mode directive"
        if [[ "$dry_run" == "dry-run" ]]; then
            fixes_log_info "  [DRY-RUN] Would disable strict mode"
        else
            sed -i 's/^set -euo pipefail$/# &  # Disabled for MSYS2 compatibility/g' "$ralphy_file"
            fixes_log_info "  Disabled strict mode directive"
            ((fixed_count++))
        fi
    else
        fixes_log_info "  No strict mode directive found"
    fi
    
    # --- Optional: Fix common problematic patterns ---
    # Only fix if strict mode was found (indicates problematic script)
    
    if [[ $fixed_count -gt 0 ]] || [[ "$dry_run" == "dry-run" ]]; then
        # Check for command -v patterns
        if grep -q 'if ! command -v' "$ralphy_file" 2>/dev/null; then
            fixes_log_info "  Found command -v checks (will work without strict mode)"
        fi
        
        # Check for arithmetic operations
        if grep -qE '\(\([a-zA-Z_][a-zA-Z0-9_]*\+\+\)\)' "$ralphy_file" 2>/dev/null; then
            fixes_log_info "  Found arithmetic increment operations (will work without strict mode)"
        fi
    fi
    
    # --- Summary ---
    if [[ "$dry_run" == "dry-run" ]]; then
        fixes_log_info "Dry run complete. Run without --dry-run to apply fixes."
        return 0
    fi
    
    if [[ $fixed_count -gt 0 ]]; then
        fixes_log_info "Applied $fixed_count fix to: $ralphy_file"
        if [[ -n "$backup_file" ]]; then
            fixes_log_info "Backup created: $backup_file"
        fi
        fixes_log_info ""
        fixes_log_info "IMPORTANT: The script's strict mode has been disabled."
        fixes_log_info "This allows the script to run on MSYS2 but may reduce"
        fixes_log_info "error detection. Review the script manually if needed."
        return 0
    else
        fixes_log_info "No fixes applied to: $ralphy_file"
        [[ -f "$backup_file" ]] && rm -f "$backup_file" 2>/dev/null
        return 0
    fi
}

#-------------------------------------------------------------------------------
# Batch Fix Application
#-------------------------------------------------------------------------------

fix_ralphy_directory() {
    local root_dir="${1:-.}"
    local dry_run="${2:-}"
    local fixed_count=0
    local found_count=0
    
    fixes_log_info "Searching for ralphy.sh files in: $root_dir"
    
    while IFS= read -r -d '' file; do
        ((found_count++))
        fixes_log_info "Found: $file"
        
        if [[ "$dry_run" == "dry-run" ]]; then
            if grep -q '^set -euo pipefail$' "$file" 2>/dev/null; then
                fixes_log_info "  [DRY-RUN] Would fix this file"
            fi
        else
            if fix_ralphy_for_msys2 "$file"; then
                ((fixed_count++))
            fi
        fi
    done < <(find "$root_dir" -name "ralphy.sh" -type f -print0 2>/dev/null)
    
    fixes_log_info "Summary: Found $found_count files, fixed $fixed_count files"
    
    if [[ $found_count -eq 0 ]]; then
        fixes_log_warn "No ralphy.sh files found in: $root_dir"
        return 1
    fi
    
    return 0
}

#-------------------------------------------------------------------------------
# User Notification
#-------------------------------------------------------------------------------

warn_msys2_compatibility() {
    cat << 'EOF'

============================================
⚠️  MSYS2 Compatibility Notice
============================================

You are running DevKitX/Ralphy in a MSYS2/Git Bash
environment on Windows. This environment has known
compatibility issues with strict bash error handling.

Automatic compatibility fixes have been applied.
If you encounter any issues, please report at:

https://github.com/iskisraell/devkitx/issues

============================================

EOF
}

#-------------------------------------------------------------------------------
# Syntax Validation
#-------------------------------------------------------------------------------

fixes_validate_syntax() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        fixes_log_error "File not found: $file"
        return 1
    fi
    
    if bash -n "$file" 2>/dev/null; then
        fixes_log_info "Syntax valid: $file"
        return 0
    else
        fixes_log_error "Syntax error in: $file"
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Main Entry Point
#-------------------------------------------------------------------------------

fixes_usage() {
    cat << EOF
Usage: $(basename "$0") <command> [options]

Commands:
  fix <file>             Apply fixes to a ralphy.sh file
  fix-dry <file>         Preview fixes without applying
  fix-dir <directory>    Fix all ralphy.sh files in directory
  validate <file>        Validate bash syntax
  help                   Show this help message

Options:
  --verbose, -v          Enable verbose output

Examples:
  $(basbasename "$0") fix ./ralphy.sh
  $(basename "$0") fix-dry ./ralphy.sh
  $(basename "$0") fix-dir .

Environment Variables:
  MSYS2_AUTO_FIX         Enable auto-fix (default: true)
  MSYS2_CREATE_BACKUPS   Create backups (default: true)
  MSYS2_BACKUP_DIR       Backup directory

EOF
}

fixes_main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        fix)
            fix_ralphy_for_msys2 "$1"
            ;;
        fix-dry)
            fix_ralphy_for_msys2 "$1" "dry-run"
            ;;
        fix-dir)
            fix_ralphy_directory "${1:-.}"
            ;;
        validate)
            fixes_validate_syntax "$1"
            ;;
        help|--help|-h|"")
            fixes_usage
            ;;
        *)
            fixes_log_error "Unknown command: $command"
            fixes_usage
            return 1
            ;;
    esac
}

# Run main if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    fixes_main "$@"
fi

# Export functions
export -f fixes_log_info fixes_log_warn fixes_log_error fixes_log_debug
export -f fixes_create_backup fix_ralphy_for_msys2 fix_ralphy_directory
export -f warn_msys2_compatibility fixes_validate_syntax
export -f fixes_main fixes_usage

export FIXES_SCRIPT_VERSION
