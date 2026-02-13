#!/usr/bin/env bash

# sync-runner.sh - Master coordinator for sync workflows
# Runs validation scripts and outputs summary.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting sync runner"
echo "=========================================="

# Defaults
RUN_DOCS=true
RUN_WORKFLOWS=true
RUN_SKILLS=true
DAYS_STALE_DOCS=30
DAYS_STALE_WORKFLOWS=180
DAYS_STALE_SKILLS=90

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --only-docs)
            RUN_WORKFLOWS=false
            RUN_SKILLS=false
            shift
            ;;
        --only-workflows)
            RUN_DOCS=false
            RUN_SKILLS=false
            shift
            ;;
        --only-skills)
            RUN_DOCS=false
            RUN_WORKFLOWS=false
            shift
            ;;
        --stale-days)
            DAYS_STALE_DOCS="$2"
            DAYS_STALE_WORKFLOWS="$2"
            DAYS_STALE_SKILLS="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--only-docs|--only-workflows|--only-skills] [--stale-days N]"
            exit 1
            ;;
    esac
done

SUMMARY_FILE="${SUMMARY_FILE:-/tmp/sync-summary-$(date +%Y%m%d).txt}"
> "$SUMMARY_FILE"

# Helper to log and capture
log() {
    echo "$1"
    echo "$1" >> "$SUMMARY_FILE"
}

# 1. Documentation sync
if [[ "$RUN_DOCS" == "true" ]]; then
    log "📚 DOCUMENTATION SYNC"
    log "------------------------------------------"
    echo "Running link validation..."
    bash scripts/check-links.sh 2>&1 | tee -a "$SUMMARY_FILE"
    echo "Running stale detection (older than $DAYS_STALE_DOCS days)..."
    bash scripts/find-stale.sh "$DAYS_STALE_DOCS" 2>&1 | tee -a "$SUMMARY_FILE"
    echo "Running schema validation..."
    node scripts/validate-schema.js 2>&1 | tee -a "$SUMMARY_FILE"
    log ""
fi

# 2. Workflow sync
if [[ "$RUN_WORKFLOWS" == "true" ]]; then
    log "💎 WORKFLOW SYNC"
    log "------------------------------------------"
    echo "Running link validation..."
    bash scripts/check-links.sh 2>&1 | tee -a "$SUMMARY_FILE"
    echo "Running stale detection (older than $DAYS_STALE_WORKFLOWS days)..."
    bash scripts/find-stale.sh "$DAYS_STALE_WORKFLOWS" 2>&1 | tee -a "$SUMMARY_FILE"
    log ""
fi

# 3. Skills sync
if [[ "$RUN_SKILLS" == "true" ]]; then
    log "🛠️  SKILLS SYNC"
    log "------------------------------------------"
    echo "Running link validation..."
    bash scripts/check-links.sh 2>&1 | tee -a "$SUMMARY_FILE"
    echo "Running stale detection (older than $DAYS_STALE_SKILLS days)..."
    bash scripts/find-stale.sh "$DAYS_STALE_SKILLS" 2>&1 | tee -a "$SUMMARY_FILE"
    log ""
fi

log "=========================================="
log "✅ Sync runner completed"
log "Summary saved to: $SUMMARY_FILE"
echo ""
echo "Next steps:"
echo "1. Review the output above for errors/warnings."
echo "2. Execute the relevant sync workflows for remediation:"
echo "   - .agent/workflows/docs/docs-audit.md"
echo "   - .agent/workflows/workflow-sync.md"
echo "   - .agent/workflows/skills-sync.md"
echo "3. Update DOC_STATUS.md with findings."
echo ""
echo "For detailed guidance, see .agent/workflows/sync-coordinator.md"
