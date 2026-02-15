param(
	[Parameter(Mandatory = $false)]
	[string]$ProjectRef,
	[Parameter(Mandatory = $false)]
	[switch]$SkipTests
)

$ErrorActionPreference = 'Stop'

function Step($message) {
	Write-Host ""
	Write-Host "==> $message" -ForegroundColor Cyan
}

function Assert-Command($name) {
	if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
		throw "Command '$name' not found in PATH."
	}
}

function Assert-Env($key) {
	$entry = Get-Item -Path "env:$key" -ErrorAction SilentlyContinue
	if (-not $entry -or [string]::IsNullOrWhiteSpace($entry.Value)) {
		throw "Missing required environment variable: $key"
	}
}

Step "Validating required environment variables"
Assert-Env "SUPABASE_URL"
Assert-Env "SUPABASE_SERVICE_ROLE_KEY"
Assert-Env "RSVP_TOKEN_SECRET"
Assert-Env "RSVP_ADMIN_USER"
Assert-Env "RSVP_ADMIN_PASSWORD"

if (-not $ProjectRef -or [string]::IsNullOrWhiteSpace($ProjectRef)) {
	$ProjectRef = ([uri]$env:SUPABASE_URL).Host.Split('.')[0]
}

if (-not $ProjectRef -or [string]::IsNullOrWhiteSpace($ProjectRef)) {
	throw "Could not resolve project ref from SUPABASE_URL. Pass -ProjectRef explicitly."
}

Step "Checking Supabase CLI availability"
Assert-Command "supabase"
supabase --version

Step "Linking remote project ($ProjectRef)"
supabase link --project-ref $ProjectRef

Step "Listing available projects (quick auth sanity check)"
supabase projects list

Step "Applying migrations to remote (db push)"
supabase db push

Step "Reminder: run SQL verification in Supabase SQL Editor"
Write-Host "Use: supabase/verification/rsvp_schema_checks.sql" -ForegroundColor Yellow

if (-not $SkipTests) {
	Step "Running RSVP critical API test suite"
	pnpm test -- --runInBand tests/api/rsvp.context.test.ts tests/api/rsvp.post-canonical.test.ts tests/api/rsvp.channel.test.ts tests/api/rsvp.admin.test.ts tests/api/rsvp.export.test.ts
}

Step "Runbook completed"
Write-Host "Next: verify RLS/policies/constraints in SQL editor and do manual API smoke." -ForegroundColor Green
