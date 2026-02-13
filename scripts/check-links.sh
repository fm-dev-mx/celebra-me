#!/bin/bash

# check-links.sh - Validate internal links in documentation and workflows
# Based on sync framework automation opportunities

# Change to project root directory (where this script is located)
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || { echo "Failed to change to project root"; exit 1; }

set -e

# Enable nullglob so non-matching globs expand to empty list
shopt -s nullglob

echo "🔗 Starting link validation check..."
echo "Project root: $PROJECT_ROOT"
echo "====================================="

ERRORS=0
CHECKED=0

# Function to check if a linked file exists
check_link() {
    local file="$1"
    local link="$2"
    local line_num="$3"
    
    # Skip external links
    if echo "$link" | grep -qE "^(http|https|ftp)://"; then
        return 0
    fi
    
    # Skip mailto links
    if echo "$link" | grep -qE "^mailto:"; then
        return 0
    fi
    
    # Handle different link formats
    local target_path
    
    # Remove anchor (#) if present
    link="${link%%#*}"
    
    # Handle relative paths
    if [[ "$link" == /* ]]; then
        # Absolute path from repo root
        target_path=".$link"
    elif [[ "$link" == ./* ]]; then
        # Relative to current file's directory
        local file_dir=$(dirname "$file")
        target_path="$file_dir/${link:2}"
    elif [[ "$link" == ../* ]]; then
        # Relative parent
        local file_dir=$(dirname "$file")
        target_path="$file_dir/$link"
    else
        # Assume relative to current file
        local file_dir=$(dirname "$file")
        target_path="$file_dir/$link"
    fi
    
    # Check if file exists
    if [[ -f "$target_path" ]]; then
        echo "  ✅ $link"
        return 0
    else
        echo "  ❌ $link (line $line_num) - File not found: $target_path"
        return 1
    fi
}

# Function to check a single file
check_file() {
    local file="$1"
    echo "Checking: $file"
    
    local links_found=0
    
    # Use grep to find all markdown links with line numbers
    # Format: line_number:match
    while IFS=: read -r line_num match; do
        # Extract the URL from the markdown link [text](url)
        # Remove the [text] part and keep just the url
        local link
        link=$(echo "$match" | sed -E 's/^\[[^]]+\]\(([^)]+)\)$/\1/')
        
        if [[ -n "$link" ]]; then
            check_link "$file" "$link" "$line_num" || ((ERRORS++))
            ((CHECKED++))
            ((links_found++))
        fi
    done < <(grep -n -oE '\[[^]]+\]\([^)]+\)' "$file" 2>/dev/null || true)
    
    if [[ $links_found -gt 0 ]]; then
        echo "  Found $links_found links"
    fi
}

# Main execution
echo "Phase 1: Checking documentation files..."
for file in docs/*.md docs/audit/*.md; do
    if [[ -f "$file" ]]; then
        check_file "$file"
    fi
done

echo ""
echo "Phase 2: Checking workflow files..."
for file in .agent/workflows/*.md .agent/workflows/docs/*.md .agent/workflows/archive/*.md; do
    if [[ -f "$file" ]]; then
        check_file "$file"
    fi
done

echo ""
echo "Phase 3: Checking skill files..."
for file in .agent/skills/*/*.md; do
    if [[ -f "$file" ]]; then
        check_file "$file"
    fi
done

echo ""
echo "====================================="
echo "Link validation complete!"
echo "Total links checked: $CHECKED"
echo "Errors found: $ERRORS"

# Restore nullglob setting
shopt -u nullglob

if [[ $ERRORS -eq 0 ]]; then
    echo "✅ All links are valid!"
    exit 0
else
    echo "❌ Found $ERRORS broken links"
    echo ""
    echo "Next steps:"
    echo "1. Review the broken links above"
    echo "2. Update links to point to existing files"
    echo "3. Run this check again to verify fixes"
    exit 1
fi