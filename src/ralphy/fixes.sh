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

FIXES_SCRIPT_VERSION="1.0.0"
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

# Create a timestamped backup of a file
fixes_create_backup() {
    local file="$1"
    local backup_file=""
    local timestamp
    
    if [[ ! -f "$file" ]]; then
        fixes_log_error "Cannot backup non-existent file: $file"
        return 1
    fi
    
    # Create backup directory if it doesn't exist
    mkdir -p "$FIXES_BACKUP_DIR" 2>/dev/null || {
        # Fallback to same directory if we can't create backup dir
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

# List available backups for a file
fixes_list_backups() {
    local file="$1"
    local base_file
    local backups=()
    
    base_file=$(basename "$file")
    
    # Find backup files
    while IFS= read -r backup; do
        backups+=("$backup")
    done < <(find . -maxdepth 1 -name "${base_file}.bak.*" -type f 2>/dev/null | sort)
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        echo "No backups found for: $file"
        return 1
    fi
    
    echo "Available backups for $base_file:"
    local i=1
    for backup in "${backups[@]}"; do
        printf "  %d. %s\n" "$i" "$backup"
        ((i++))
    done
    
    return 0
}

# Restore from backup
fixes_restore_backup() {
    local file="$1"
    local backup="$2"
    
    if [[ ! -f "$backup" ]]; then
        fixes_log_error "Backup file not found: $backup"
        return 1
    fi
    
    if cp "$backup" "$file" 2>/dev/null; then
        fixes_log_info "Restored from backup: $backup -> $file"
        return 0
    else
        fixes_log_error "Failed to restore from: $backup"
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Pattern Detection
#-------------------------------------------------------------------------------

# Check if a file contains MSYS2-problematic patterns
fixes_check_patterns() {
    local file="$1"
    local issues=()
    
    if [[ ! -f "$file" ]]; then
        fixes_log_error "File not found: $file"
        return 1
    fi
    
    # Pattern 1: command -v checks without subshell
    if grep -n 'if ! command -v [[:alnum:]_/-]* >/dev/null 2>&1; then' "$file" >/dev/null 2>&1; then
        issues+=("command -v checks without subshell (pattern 1)")
    fi
    
    # Pattern 2: Arithmetic operations
    if grep -n '(([[:space:]]*[[:alnum:]_]*++[[:space:]]*))' "$file" >/dev/null 2>&1; then
        issues+=("Arithmetic increment operations (pattern 2)")
    fi
    
    # Pattern 3: set -euo pipefail
    if grep -n '^set -euo pipefail$' "$file" >/dev/null 2>&1; then
        issues+=("Strict mode 'set -euo pipefail' (pattern 3)")
    fi
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        fixes_log_warn "Potential MSYS2 issues found in $file:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        return 0
    else
        fixes_log_info "No obvious MSYS2 issues found in: $file"
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Fix Application
#-------------------------------------------------------------------------------

# Apply MSYS2 compatibility fixes to a ralphy.sh file
#
# Arguments:
#   $1 - Path to ralphy.sh file
#   $2 - Optional: "dry-run" to preview changes without applying
#
# Returns:
#   0 on success, 1 on error
fix_ralphy_for_msys2() {
    local ralphy_file="$1"
    local dry_run="${2:-}"
    local fixed_count=0
    local backup_file=""
    
    # Validate input
    if [[ -z "$ralphy_file" ]]; then
        fixes_log_error "No ralphy file specified"
        return 1
    fi
    
    if [[ ! -f "$ralphy_file" ]]; then
        fixes_log_error "ralphy_file not found: $ralphy_file"
        return 1
    fi
    
    fixes_log_info "Processing: $ralphy_file"
    
    # Check if MSYS2 environment is detected
    if ! . "$(dirname "$ralphy_file")/../../core/detect.sh" 2>/dev/null && \
       ! command -v detect_msys2_environment >/dev/null 2>&1; then
        fixes_log_warn "MSYS2 detection not available, proceeding anyway"
    fi
    
    # Check if MSYS2 is actually detected (optional - can be skipped)
    # if detect_msys2_environment; then
    #     fixes_log_info "MSYS2 environment detected, applying fixes"
    # else
    #     fixes_log_warn "Not running in MSYS2 environment, fixes may not be needed"
    # fi
    
    # Create backup unless dry-run
    if [[ "$dry_run" != "dry-run" ]]; then
        backup_file=$(fixes_create_backup "$ralphy_file")
        if [[ -z "$backup_file" ]]; then
            fixes_log_error "Failed to create backup, aborting"
            return 1
        fi
    fi
    
    # --- Fix Pattern 1: Wrap command -v checks in subshells ---
    # Pattern: if ! command -v TOOL >/dev/null 2>&1; then
    # Replace with: if ! (command -v TOOL >/dev/null 2>&1); then
    
    fixes_log_debug "Applying fix for command -v checks..."
    
    local pattern1_count
    pattern1_count=$(grep -c 'if ! \(command -v [[:alnum:]_/-]*\) >/dev/null 2>&1; then' "$ralphy_file" 2>/dev/null || echo "0")
    
    if [[ "$dry_run" == "dry-run" ]]; then
        if [[ "$pattern1_count" -gt 0 ]]; then
            fixes_log_info "  [DRY-RUN] Would fix $pattern1_count command -v checks"
        fi
    else
        if [[ "$pattern1_count" -gt 0 ]]; then
            sed -i 's/if ! \(command -v [[:alnum:]_/-]*\) >\/dev\/null 2>&1; then/if ! (\1 >\/dev\/null 2\&1); then/g' "$ralphy_file"
            fixes_log_info "  Fixed $pattern1_count command -v checks"
            ((fixed_count++))
        fi
    fi
    
    # Also fix positive checks (if command -v without !)
    local pattern1b_count
    pattern1b_count=$(grep -c 'if \(command -v [[:alnum:]_/-]*\) >/dev/null 2>&1; then' "$ralphy_file" 2>/dev/null || echo "0")
    
    if [[ "$dry_run" == "dry-run" ]]; then
        if [[ "$pattern1b_count" -gt 0 ]]; then
            fixes_log_info "  [DRY-RUN] Would fix $pattern1b_count positive command -v checks"
        fi
    else
        if [[ "$pattern1b_count" -gt 0 ]]; then
            sed -i 's/if \(command -v [[:alnum:]_/-]*\) >\/dev\/null 2>&1; then/if (\1 >\/dev\/null 2\&1); then/g' "$ralphy_file"
            fixes_log_info "  Fixed $pattern1b_count positive command -v checks"
            ((fixed_count++))
        fi
    fi
    
    # --- Fix Pattern 2: Append || true to arithmetic operations ---
    # Pattern: ((VAR++))
    # Replace with: ((VAR++)) || true
    
    fixes_log_debug "Applying fix for arithmetic operations..."
    
    local pattern2_count
    pattern2_count=$(grep -c '(([[:space:]]*\([[:alnum:]_]*\)++[[:space:]]*))' "$ralphy_file" 2>/dev/null || echo "0")
    
    if [[ "$dry_run" == "dry-run" ]]; then
        if [[ "$pattern2_count" -gt 0 ]]; then
            fixes_log_info "  [DRY-RUN] Would fix $pattern2_count arithmetic operations"
        fi
    else
        if [[ "$pattern2_count" -gt 0 ]]; then
            # Use a more careful sed pattern
            sed -i 's/(([[:space:]]*\([[:alnum:]_]*\)++[[:space:]]*))/\1++)) || true/g' "$ralphy_file"
            # Also handle simpler cases
            sed -i 's/(\([^)]*\)\+\+)/(\1++)) || true/g' "$ralphy_file"
            fixes_log_info "  Fixed $pattern2_count arithmetic operations"
            ((fixed_count++))
        fi
    fi
    
    # --- Fix Pattern 3: Disable set -euo pipefail ---
    # Pattern: set -euo pipefail
    # Replace with: # set -euo pipefail  # Disabled for MSYS2
    
    fixes_log_debug "Applying fix for strict mode..."
    
    local pattern3_count
    pattern3_count=$(grep -c '^set -euo pipefail$' "$ralphy_file" 2>/dev/null || echo "0")
    
    if [[ "$dry_run" == "dry-run" ]]; then
        if [[ "$pattern3_count" -gt 0 ]]; then
            fixes_log_info "  [DRY-RUN] Would disable $pattern3_count strict mode directives"
        fi
    else
        if [[ "$pattern3_count" -gt 0 ]]; then
            sed -i 's/^set -euo pipefail$/# set -euo pipefail  # Disabled for MSYS2 compatibility/g' "$ralphy_file"
            fixes_log_info "  Disabled $pattern3_count strict mode directives"
            ((fixed_count++))
        fi
    fi
    
    # --- Additional Fix: Wrap cd operations in subshells ---
    # Pattern: cd /some/path || exit
    # Replace with: (cd /some/path || exit)
    
    fixes_log_debug "Checking for problematic cd operations..."
    
    local pattern4_count
    pattern4_count=$(grep -n 'cd [[:alnum:]/._-]* ||' "$ralphy_file" 2>/dev/null | grep -c 'exit\|return' || echo "0")
    
    if [[ "$dry_run" == "dry-run" ]]; then
        if [[ "$pattern4_count" -gt 0 ]]; then
            fixes_log_info "  [DRY-RUN] Would fix $pattern4_count cd operations"
        fi
    else
        # This is more complex, skip for now
        if [[ "$pattern4_count" -gt 0 ]]; then
            fixes_log_warn "  Found $pattern4_count cd operations with exit, manual review recommended"
        fi
    fi
    
    # --- Summary ---
    if [[ "$dry_run" == "dry-run" ]]; then
        fixes_log_info "Dry run complete. Run without --dry-run to apply fixes."
        return 0
    fi
    
    if [[ $fixed_count -gt 0 ]]; then
        fixes_log_info "Applied $fixed_count fix types to: $ralphy_file"
        fixes_log_info "Backup created: $backup_file"
        return 0
    else
        fixes_log_info "No fixes needed for: $ralphy_file"
        # Remove empty backup if no changes made
        [[ -f "$backup_file" ]] && rm -f "$backup_file" 2>/dev/null
        return 0
    fi
}

#-------------------------------------------------------------------------------
# Batch Fix Application
#-------------------------------------------------------------------------------

# Apply fixes to all ralphy.sh files in a directory tree
#
# Arguments:
#   $1 - Root directory to search
#   $2 - Optional: "dry-run" to preview
fix_ralphy_directory() {
    local root_dir="${1:-.}"
    local dry_run="${2:-}"
    local fixed_count=0
    local found_count=0
    
    fixes_log_info "Searching for ralphy.sh files in: $root_dir"
    
    # Find all ralphy.sh files
    while IFS= read -r -d '' file; do
        ((found_count++))
        fixes_log_info "Found: $file"
        
        if [[ "$dry_run" == "dry-run" ]]; then
            fixes_check_patterns "$file"
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
# Configuration
#-------------------------------------------------------------------------------

# Load configuration from environment or config file
fixes_load_config() {
    # Default configuration
    MSYS2_AUTO_FIX="${MSYS2_AUTO_FIX:-true}"
    MSYS2_CREATE_BACKUPS="${MSYS2_CREATE_BACKUPS:-true}"
    MSYS2_BACKUP_DIR="${MSYS2_BACKUP_DIR:-./.ralphy-backups}"
    MSYS2_LOG_LEVEL="${MSYS2_LOG_LEVEL:-info}"
    
    # Load from config file if exists
    local config_file="${1:-.devkitxrc}"
    if [[ -f "$config_file" ]]; then
        # Source shell config
        # shellcheck source=.devkitxrc
        . "$config_file" 2>/dev/null || true
    fi
    
    # Apply loaded values
    FIXES_BACKUP_DIR="${MSYS2_BACKUP_DIR}"
    FIXES_DEBUG="${MSYS2_LOG_LEVEL:-}" == "debug"
}

#-------------------------------------------------------------------------------
# User Notification
#-------------------------------------------------------------------------------

# Display MSYS2 compatibility warning
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

# Validate bash syntax of a file
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
# Main Entry Point (when run directly)
#-------------------------------------------------------------------------------

# Display usage information
fixes_usage() {
    cat << EOF
Usage: $(basename "$0") <command> [options]

Commands:
  check <file>           Check for MSYS2 issues in a file
  fix <file>             Apply fixes to a ralphy.sh file
  fix-dry <file>         Preview fixes without applying
  fix-dir <directory>    Fix all ralphy.sh files in directory
  backup <file>          Create backup of a file
  restore <backup>       Restore from backup
  validate <file>        Validate bash syntax
  info                   Show environment info
  help                   Show this help message

Options:
  --backup-dir <dir>     Specify backup directory
  --verbose, -v          Enable verbose output
  --debug, -d            Enable debug output

Examples:
  $(basename "$0") fix ./ralphy.sh
  $(basename "$0") fix-dry ./ralphy.sh
  $(basename "$0") check ./ralphy.sh
  $(basename "$0") fix-dir .

Environment Variables:
  MSYS2_AUTO_FIX         Enable auto-fix (default: true)
  MSYS2_CREATE_BACKUPS   Create backups (default: true)
  MSYS2_BACKUP_DIR       Backup directory
  MSYS2_LOG_LEVEL        Log level: debug, info, warn, error

EOF
}

# Main entry point for CLI usage
fixes_main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        check)
            fixes_check_patterns "$1"
            ;;
        fix)
            fix_ralphy_for_msys2 "$1"
            ;;
        fix-dry)
            fix_ralphy_for_msys2 "$1" "dry-run"
            ;;
        fix-dir)
            fix_ralphy_directory "${1:-.}"
            ;;
        backup)
            fixes_create_backup "$1"
            ;;
        restore)
            fixes_restore_backup "$2" "$1"
            ;;
        validate)
            fixes_validate_syntax "$1"
            ;;
        info)
            detect_environment_summary 2>/dev/null || {
                echo "Run with: source $(dirname "$0")/core/detect.sh"
            }
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

# Export functions for sourcing
export -f fixes_log_info fixes_log_warn fixes_log_error fixes_log_debug
export -f fixes_create_backup fixes_list_backups fixes_restore_backup
export -f fixes_check_patterns fix_ralphy_for_msys2 fix_ralphy_directory
export -f fixes_load_config warn_msys2_compatibility fixes_validate_syntax
export -f fixes_main fixes_usage

# Export version
export FIXES_SCRIPT_VERSION
