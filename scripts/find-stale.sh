#!/bin/bash

# find-stale.sh - Detect stale files based on modification time
# Based on sync framework automation opportunities

set -e

DEFAULT_DAYS=180  # 6 months
DAYS=${1:-$DEFAULT_DAYS}

echo "🔍 Searching for stale files (older than $DAYS days)..."
echo "========================================================"

STALE_COUNT=0
TOTAL_CHECKED=0

# Function to check a directory for stale files
check_directory() {
    local dir="$1"
    local pattern="$2"
    local description="$3"
    
    echo ""
    echo "$description:"
    echo "----------------------------------------"
    
    local found=0
    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            ((TOTAL_CHECKED++))
            
            # Get days since modification
            local now=$(date +%s)
            local mod_time=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file")
            local days_old=$(( (now - mod_time) / 86400 ))
            
            if [[ $days_old -gt $DAYS ]]; then
                echo "  ⚠️  $file ($days_old days old)"
                ((found++))
                ((STALE_COUNT++))
            fi
        fi
    done < <(find "$dir" -name "$pattern" -type f 2>/dev/null || true)
    
    if [[ $found -eq 0 ]]; then
        echo "  ✅ No stale files found"
    fi
}

# Main execution
echo "Phase 1: Checking documentation..."
check_directory "docs" "*.md" "Documentation files"

echo ""
echo "Phase 2: Checking workflows..."
check_directory ".agent/workflows" "*.md" "Workflow files"

echo ""
echo "Phase 3: Checking skills..."
check_directory ".agent/skills" "*.md" "Skill files"

echo ""
echo "Phase 4: Checking source code..."
check_directory "src" "*.ts" "TypeScript files"
check_directory "src" "*.tsx" "TypeScript React files"
check_directory "src" "*.astro" "Astro files"
check_directory "src/styles" "*.scss" "SCSS files"

echo ""
echo "========================================================"
echo "Stale file detection complete!"
echo "Total files checked: $TOTAL_CHECKED"
echo "Stale files found: $STALE_COUNT"

if [[ $STALE_COUNT -eq 0 ]]; then
    echo "✅ No stale files detected!"
    echo ""
    echo "Recommendation:"
    echo "- Continue regular maintenance schedule"
    exit 0
else
    echo "⚠️  Found $STALE_COUNT potentially stale files"
    echo ""
    echo "Next steps:"
    echo "1. Review each stale file above"
    echo "2. Determine if file is still needed"
    echo "3. If obsolete:"
    echo "   - Archive: Move to appropriate archive directory"
    echo "   - Update: Refresh content if still relevant"
    echo "   - Delete: Remove if completely obsolete (update references first)"
    echo "4. Update documentation to reflect changes"
    echo ""
    echo "Automation notes:"
    echo "- Files > 180 days (6 months) may need review"
    echo "- Files > 365 days (1 year) likely need archiving"
    echo "- Consider project velocity when setting thresholds"
    exit 0  # Exit with 0 since this is informational, not an error
fi