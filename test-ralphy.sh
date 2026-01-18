#!/usr/bin/env bash
# set -euo pipefail  # Disabled for MSYS2 compatibility

if ! command -v opencode >/dev/null 2>&1; then
    echo "OpenCode not found"
    exit 1
fi

iteration=0
((iteration++))
echo "Iteration: $iteration"
