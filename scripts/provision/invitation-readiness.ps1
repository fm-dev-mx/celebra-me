<#
.SYNOPSIS
    Local Invitation Readiness Validation Workflow Script
.DESCRIPTION
    Thin process orchestrator for persistent-local database migrations, schema alignment,
    canonical TypeScript readiness evaluation, code quality, test suite, type checking,
    and production build.
#>

function Invoke-InvitationReadiness {
    [CmdletBinding()]
    param (
        [switch]$Interactive = $false
    )

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " STARTING LOCAL INVITATION READINESS VALIDATION WORKFLOW    " -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan

    $results = [ordered]@{
        LocalMigration       = "NOT_RUN"
        LocalAudit           = "NOT_RUN"
        RominaReadiness      = "NOT_RUN"
        ESLint               = "NOT_RUN"
        Stylelint            = "NOT_RUN"
        EventParity          = "NOT_RUN"
        NoPII                = "NOT_RUN"
        JestSuite            = "NOT_RUN"
        TypeCheck            = "NOT_RUN"
        ProductionBuild      = "NOT_RUN"
    }

    $rominaVerdict = "BLOCKED"
    $rominaReasons = @()

    # 1. Local Database Migrations
    Write-Host "`n[1/9] Running persistent-local migrations (pnpm db:local:migrate)..." -ForegroundColor Yellow
    pnpm db:local:migrate
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        $results.LocalMigration = "PASS"
        Write-Host "  -> Local migrations succeeded." -ForegroundColor Green
    } else {
        $results.LocalMigration = "FAIL"
        Write-Host "  -> Local migrations failed with exit code $exitCode." -ForegroundColor Red
    }

    # 2. Local Database Schema Audit
    Write-Host "`n[2/9] Auditing persistent-local schema (pnpm db:local:audit)..." -ForegroundColor Yellow
    pnpm db:local:audit
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        $results.LocalAudit = "PASS"
        Write-Host "  -> Local audit succeeded." -ForegroundColor Green
    } else {
        $results.LocalAudit = "FAIL"
        Write-Host "  -> Local audit failed with exit code $exitCode." -ForegroundColor Red
    }

    # 3. Romina Canonical TypeScript Readiness Evaluation
    Write-Host "`n[3/9] Validating Romina Rios Chaparro canonical TypeScript readiness..." -ForegroundColor Yellow
    $readinessJson = pnpm exec tsx scripts/provision/invitation-readiness.ts 2>&1
    $statusExit = $LASTEXITCODE

    try {
        $jsonText = ($readinessJson | Where-Object { $_ -notlike "WARNING:*" -and $_ -notlike "$ *" }) -join "`n"
        $readinessObj = $jsonText | ConvertFrom-Json
        $rominaVerdict = $readinessObj.verdict
        $rominaReasons = @($readinessObj.reasons)

        if ($rominaVerdict -eq "READY") {
            $results.RominaReadiness = "PASS"
        } elseif ($rominaVerdict -eq "NO-GO") {
            $results.RominaReadiness = "FAIL (NO-GO)"
        } else {
            $results.RominaReadiness = "BLOCKED"
        }
    } catch {
        $rominaVerdict = "BLOCKED"
        $rominaReasons += "Failed to parse TypeScript readiness output: $_"
        $results.RominaReadiness = "BLOCKED"
    }

    Write-Host "  -> Romina Verdict: $rominaVerdict" -ForegroundColor ($rominaVerdict -eq "READY" ? "Green" : "Red")
    foreach ($reason in $rominaReasons) {
        Write-Host "     - Issue: $reason" -ForegroundColor Yellow
    }

    # 4. ESLint
    Write-Host "`n[4/9] Running ESLint (pnpm lint)..." -ForegroundColor Yellow
    pnpm lint
    if ($LASTEXITCODE -eq 0) { $results.ESLint = "PASS" } else { $results.ESLint = "FAIL" }

    # 5. Stylelint
    Write-Host "`n[5/9] Running Stylelint (pnpm lint:styles)..." -ForegroundColor Yellow
    pnpm lint:styles
    if ($LASTEXITCODE -eq 0) { $results.Stylelint = "PASS" } else { $results.Stylelint = "FAIL" }

    # 6. Event Parity Validation
    Write-Host "`n[6/9] Validating event parity (pnpm validate:event-parity)..." -ForegroundColor Yellow
    pnpm validate:event-parity
    if ($LASTEXITCODE -eq 0) { $results.EventParity = "PASS" } else { $results.EventParity = "FAIL" }

    # 7. No PII Validation
    Write-Host "`n[7/9] Validating PII safety (pnpm validate:no-pii)..." -ForegroundColor Yellow
    pnpm validate:no-pii
    if ($LASTEXITCODE -eq 0) { $results.NoPII = "PASS" } else { $results.NoPII = "FAIL" }

    # 8. Complete Jest Test Suite
    Write-Host "`n[8/9] Running complete Jest suite (pnpm test --coverage=false --runInBand)..." -ForegroundColor Yellow
    pnpm test --coverage=false --runInBand
    if ($LASTEXITCODE -eq 0) { $results.JestSuite = "PASS" } else { $results.JestSuite = "FAIL" }

    # 9. Type Check & Production Build
    Write-Host "`n[9/9] Running Astro typecheck & production build (pnpm build)..." -ForegroundColor Yellow
    pnpm build
    if ($LASTEXITCODE -eq 0) {
        $results.TypeCheck = "PASS"
        $results.ProductionBuild = "PASS"
    } else {
        $results.TypeCheck = "FAIL"
        $results.ProductionBuild = "FAIL"
    }

    # Final Summary Report
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host " READINESS VALIDATION WORKFLOW SUMMARY                      " -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    foreach ($key in $results.Keys) {
        $statusStr = $results[$key]
        $color = if ($statusStr -eq "PASS") { "Green" } elseif ($statusStr -like "*FAIL*") { "Red" } else { "Yellow" }
        Write-Host ("{0,-22} : {1}" -f $key, $statusStr) -ForegroundColor $color
    }

    Write-Host "`nFINAL ROMINA LOCAL READINESS VERDICT: $rominaVerdict" -ForegroundColor ($rominaVerdict -eq "READY" ? "Green" : "Red")

    $overallSuccess = ($results.Values -notcontains "FAIL") -and ($results.Values -notcontains "FAIL (NO-GO)") -and ($rominaVerdict -eq "READY")
    $finalExitCode = if ($overallSuccess) { 0 } elseif ($rominaVerdict -eq "NO-GO") { 1 } else { 2 }

    if ($Interactive) {
        return @{
            Verdict  = $rominaVerdict
            Results  = $results
            Reasons  = $rominaReasons
            ExitCode = $finalExitCode
        }
    } else {
        exit $finalExitCode
    }
}

# Entrypoint detection: if script is executed directly via pwsh file path
if ($MyInvocation.InvocationName -ne '.' -and $MyInvocation.InvocationName -ne '&') {
    Invoke-InvitationReadiness -Interactive:$false
}
