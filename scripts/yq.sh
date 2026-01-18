#!/usr/bin/env bash
# Minimal yq-compatible functions for Ralphy
# AV-safe alternative that doesn't trigger security alerts
# Uses grep/sed/awk for YAML parsing

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get incomplete task titles
yq_get_incomplete_tasks() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        echo "ERROR: File not found: $file" >&2
        return 1
    fi
    
    # Find all lines with completed: false and get the title from 3 lines above
    grep -B3 'completed:[[:space:]]*false' "$file" 2>/dev/null | grep 'title:' | sed 's/.*title:[[:space:]]*["\047]*//' | sed 's/["\047]*[[:space:]]*$//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//'
}

# Count incomplete tasks
yq_count_incomplete() {
    local file="$1"
    yq_get_incomplete_tasks "$file" 2>/dev/null | wc -l
}

# Count completed tasks
yq_count_completed() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        echo "0"
        return
    fi
    
    # Find all lines with completed: true and get the title from 3 lines above
    grep -B3 'completed:[[:space:]]*true' "$file" 2>/dev/null | grep 'title:' | sed 's/.*title:[[:space:]]*["\047]*//' | sed 's/["\047]*[[:space:]]*$//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | wc -l
}

# Get next task title (first incomplete)
yq_get_next_task() {
    local file="$1"
    yq_get_incomplete_tasks "$file" 2>/dev/null | head -1
}

# Get tasks in parallel group
yq_get_tasks_in_group() {
    local file="$1"
    local group="$2"
    
    # Find tasks in the specified group that are incomplete
    grep -B5 "parallel_group:[[:space:]]*$group" "$file" 2>/dev/null | grep -A2 'completed:[[:space:]]*false' | grep 'title:' | sed 's/.*title:[[:space:]]*["\047]*//' | sed 's/["\047]*[[:space:]]*$//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//'
}

# Get parallel group for a task
yq_get_parallel_group() {
    local file="$1"
    local task="$2"
    echo "0"
}

# Main entry point - dispatch based on expression
main() {
    local expression=""
    local file=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -r|--raw-output)
                shift
                ;;
            -*)
                shift
                ;;
            *)
                if [[ -z "$expression" ]]; then
                    expression="$1"
                else
                    file="$1"
                fi
                shift
                ;;
        esac
    done
    
    # Handle different expressions
    if [[ "$expression" == *".tasks[] | select(.completed != true) | .title"* ]] || \
       [[ "$expression" == ".[].title" ]] || \
       [[ "$expression" == ".[]" ]]; then
        yq_get_incomplete_tasks "$file"
    elif [[ "$expression" == *".tasks[] | select(.completed != true)"* ]]; then
        yq_count_incomplete "$file"
    elif [[ "$expression" == *".tasks[] | select(.completed == true)"* ]]; then
        yq_count_completed "$file"
    elif [[ "$expression" =~ length ]]; then
        if [[ "$expression" == *".completed != true"* ]]; then
            yq_count_incomplete "$file"
        else
            yq_count_completed "$file"
        fi
    elif [[ "$expression" =~ parallel_group ]]; then
        if [[ "$expression" =~ parallel_group[[:space:]]*==[[:space:]]*([0-9]+) ]]; then
            local group="${BASH_REMATCH[1]}"
            yq_get_tasks_in_group "$file" "$group"
        fi
    else
        yq_get_incomplete_tasks "$file"
    fi
}

main "$@"
