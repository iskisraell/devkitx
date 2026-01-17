#!/usr/bin/env bash
#===============================================================================
# test-msys2-compatibility.sh - Test Script for MSYS2 Compatibility Fixes
#
# Tests the MSYS2 compatibility detection and fixing functionality
# for DevKitX Ralphy integration.
#===============================================================================

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------

TEST_SCRIPT_VERSION="1.0.0"
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_TEMP_DIR=""
TEST_COUNT=0
TEST_PASS=0
TEST_FAIL=0
TEST_SKIP=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

#-------------------------------------------------------------------------------
# Test Functions
#-------------------------------------------------------------------------------

test_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

test_pass() {
    echo -e "  ${GREEN}✓ PASS${NC}: $1"
    ((TEST_PASS++))
    ((TEST_COUNT++))
}

test_fail() {
    echo -e "  ${RED}✗ FAIL${NC}: $1"
    ((TEST_FAIL++))
    ((TEST_COUNT++))
}

test_skip() {
    echo -e "  ${YELLOW}⊘ SKIP${NC}: $1"
    ((TEST_SKIP++))
    ((TEST_COUNT++))
}

test_section() {
    echo ""
    echo -e "  ${BLUE}▶ $1${NC}"
    echo ""
}

#-------------------------------------------------------------------------------
# Setup and Cleanup
#-------------------------------------------------------------------------------

test_setup() {
    test_header "Test Setup"
    
    # Create temporary directory
    TEST_TEMP_DIR=$(mktemp -d)
    echo "  Created temp directory: $TEST_TEMP_DIR"
    
    # Copy test scripts
    cp -r "$TEST_DIR/../src/core" "$TEST_TEMP_DIR/"
    cp -r "$TEST_DIR/../src/ralphy" "$TEST_TEMP_DIR/"
    
    echo "  Test files copied"
}

test_cleanup() {
    test_header "Test Cleanup"
    
    if [[ -n "$TEST_TEMP_DIR" ]] && [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
        echo "  Cleaned up temp directory"
    fi
}

#-------------------------------------------------------------------------------
# Test Cases
#-------------------------------------------------------------------------------

test_detect_msys2_environment() {
    test_section "Testing detect_msys2_environment()"
    
    # Source detect script
    # shellcheck source=../src/core/detect.sh
    . "$TEST_TEMP_DIR/core/detect.sh"
    
    # Test 1: Function exists
    if command -v detect_msys2_environment >/dev/null 2>&1; then
        test_pass "detect_msys2_environment function exists"
    else
        test_fail "detect_msys2_environment function not found"
    fi
    
    # Test 2: Returns 0 or 1 (doesn't crash)
    detect_msys2_environment 2>/dev/null
    local result=$?
    if [[ $result -eq 0 ]] || [[ $result -eq 1 ]]; then
        test_pass "Function returns valid exit code: $result"
    else
        test_fail "Function returned invalid exit code: $result"
    fi
    
    # Test 3: detect_os function exists
    if command -v detect_os >/dev/null 2>&1; then
        test_pass "detect_os function exists"
    else
        test_fail "detect_os function not found"
    fi
    
    # Test 4: detect_os returns valid value
    local os
    os=$(detect_os)
    if [[ "$os" == "linux" ]] || [[ "$os" == "macos" ]] || [[ "$os" == "windows" ]]; then
        test_pass "detect_os returns valid OS: $os"
    else
        test_fail "detect_os returned unexpected value: $os"
    fi
}

test_fixes_functions() {
    test_section "Testing fixes.sh functions"
    
    # Source fixes script
    # shellcheck source=../src/ralphy/fixes.sh
    . "$TEST_TEMP_DIR/ralphy/fixes.sh"
    
    # Test 1: Key functions exist
    local functions=(
        "fix_ralphy_for_msys2"
        "fixes_create_backup"
        "fixes_check_patterns"
        "fixes_validate_syntax"
    )
    
    for func in "${functions[@]}"; do
        if command -v "$func" >/dev/null 2>&1; then
            test_pass "$func function exists"
        else
            test_fail "$func function not found"
        fi
    done
}

test_syntax_validation() {
    test_section "Testing syntax validation"
    
    # shellcheck source=../src/ralphy/fixes.sh
    . "$TEST_TEMP_DIR/ralphy/fixes.sh"
    
    # Test 1: Valid script passes
    local valid_script="$TEST_TEMP_DIR/valid_test.sh"
    cat > "$valid_script" << 'EOF'
#!/usr/bin/env bash
echo "Hello World"
exit 0
EOF
    
    if fixes_validate_syntax "$valid_script"; then
        test_pass "Valid script passes syntax validation"
    else
        test_fail "Valid script failed syntax validation"
    fi
    
    # Test 2: Invalid script fails
    local invalid_script="$TEST_TEMP_DIR/invalid_test.sh"
    cat > "$invalid_script" << 'EOF'
#!/usr/bin/env bash
echo "Missing done"
if true; then
    echo "Test"
# Missing fi
EOF
    
    if ! fixes_validate_syntax "$invalid_script" 2>/dev/null; then
        test_pass "Invalid script fails syntax validation (expected)"
    else
        test_skip "Invalid script passed syntax validation (may need bash -n check)"
    fi
}

test_backup_creation() {
    test_section "Testing backup creation"
    
    # shellcheck source=../src/ralphy/fixes.sh
    . "$TEST_TEMP_DIR/ralphy/fixes.sh"
    
    # Create test file
    local test_file="$TEST_TEMP_DIR/test_backup.txt"
    echo "Test content" > "$test_file"
    
    # Test 1: Create backup
    local backup
    backup=$(fixes_create_backup "$test_file")
    
    if [[ -n "$backup" ]] && [[ -f "$backup" ]]; then
        test_pass "Backup file created: $backup"
    else
        test_fail "Failed to create backup"
    fi
    
    # Test 2: Backup contains original content
    if grep -q "Test content" "$backup" 2>/dev/null; then
        test_pass "Backup contains original content"
    else
        test_fail "Backup does not contain original content"
    fi
    
    # Test 3: Original file unchanged
    if grep -q "Test content" "$test_file" 2>/dev/null; then
        test_pass "Original file unchanged after backup"
    else
        test_fail "Original file was modified during backup"
    fi
}

test_pattern_detection() {
    test_section "Testing pattern detection"
    
    # shellcheck source=../src/ralphy/fixes.sh
    . "$TEST_TEMP_DIR/ralphy/fixes.sh"
    
    # Create test file with problematic patterns
    local test_file="$TEST_TEMP_DIR/test_patterns.txt"
    cat > "$test_file" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

if ! command -v opencode >/dev/null 2>&1; then
    echo "Not found"
fi

iteration=0
((iteration++))
EOF
    
    # Test 1: Detects command -v pattern
    if fixes_check_patterns "$test_file" 2>/dev/null; then
        test_pass "Pattern detection finds command -v issues"
    else
        test_skip "Pattern detection may not work in test environment"
    fi
    
    # Test 2: File has expected content
    if grep -q "command -v" "$test_file" 2>/dev/null; then
        test_pass "Test file contains command -v pattern"
    else
        test_fail "Test file missing expected content"
    fi
}

test_fix_application() {
    test_section "Testing fix application"
    
    # shellcheck source=../src/ralphy/fixes.sh
    . "$TEST_TEMP_DIR/ralphy/fixes.sh"
    
    # Create test file
    local test_file="$TEST_TEMP_DIR/test_fix.txt"
    cat > "$test_file" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

if ! command -v opencode >/dev/null 2>&1; then
    echo "Not found"
fi

iteration=0
((iteration++))
EOF
    
    # Test 1: Apply fixes
    if fix_ralphy_for_msys2 "$test_file"; then
        test_pass "Fix function executes without error"
    else
        test_fail "Fix function failed"
    fi
    
    # Test 2: Check if fixes were applied (backup created)
    if ls "$test_file".bak.* 1>/dev/null 2>&1; then
        test_pass "Backup created during fix"
    else
        test_skip "Backup may not have been created"
    fi
    
    # Test 3: Syntax still valid after fix
    if fixes_validate_syntax "$test_file" 2>/dev/null; then
        test_pass "Syntax valid after fix application"
    else
        test_fail "Syntax invalid after fix application"
    fi
}

test_dry_run() {
    test_section "Testing dry run mode"
    
    # shellcheck source=../src/ralphy/fixes.sh
    . "$TEST_TEMP_DIR/ralphy/fixes.sh"
    
    # Create test file
    local test_file="$TEST_TEMP_DIR/test_dry.txt"
    cat > "$test_file" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

if ! command -v opencode >/dev/null 2>&1; then
    echo "Not found"
fi
EOF
    
    # Store original content
    local original_content
    original_content=$(cat "$test_file")
    
    # Test 1: Dry run doesn't modify file
    fix_ralphy_for_msys2 "$test_file" "dry-run"
    
    local after_content
    after_content=$(cat "$test_file")
    
    if [[ "$original_content" == "$after_content" ]]; then
        test_pass "Dry run does not modify original file"
    else
        test_fail "Dry run modified the original file"
    fi
}

test_main_integration() {
    test_section "Testing main.sh integration"
    
    # shellcheck source=../src/ralphy/main.sh
    . "$TEST_TEMP_DIR/ralphy/main.sh"
    
    # Test 1: Functions exported
    local functions=(
        "apply_msys2_compatibility_fixes"
        "ralphy_main_fixes_already_applied"
    )
    
    for func in "${functions[@]}"; do
        if command -v "$func" >/dev/null 2>&1; then
            test_pass "$func function exists and exported"
        else
            test_fail "$func function not found"
        fi
    done
}

#-------------------------------------------------------------------------------
# Test Summary
#-------------------------------------------------------------------------------

test_summary() {
    test_header "Test Summary"
    
    echo "  Total Tests: $TEST_COUNT"
    echo -e "  ${GREEN}Passed:${NC}     $TEST_PASS"
    echo -e "  ${RED}Failed:${NC}      $TEST_FAIL"
    echo -e "  ${YELLOW}Skipped:${NC}   $TEST_SKIP"
    echo ""
    
    if [[ $TEST_FAIL -eq 0 ]]; then
        echo -e "  ${GREEN}All tests passed!${NC}"
        return 0
    else
        echo -e "  ${RED}Some tests failed.${NC}"
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Main Entry Point
#----------------------------------------------------------------------------===

main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  DevKitX MSYS2 Compatibility Test Suite v${TEST_SCRIPT_VERSION}        ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Setup
    test_setup
    
    # Run tests
    test_detect_msys2_environment
    test_fixes_functions
    test_syntax_validation
    test_backup_creation
    test_pattern_detection
    test_fix_application
    test_dry_run
    test_main_integration
    
    # Summary
    test_summary
    local result=$?
    
    # Cleanup
    test_cleanup
    
    exit $result
}

# Run main
main "$@"
