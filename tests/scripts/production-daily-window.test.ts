/** @jest-environment node */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Runs scripts/ops/production-daily-window.ps1 end to end with gh, git, pnpm, fnm, the health
// request and sleeps replaced by PowerShell functions that only record their calls. PATH is
// emptied first, so no real gh, git or Wrangler can be reached from the script under test.

const SCRIPT = resolve('scripts/ops/production-daily-window.ps1');
const MAIN = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const WORKFLOW_ID = 4242;
const VERSION = '11111111-2222-3333-4444-555555555555';
const OTHER_VERSION = '99999999-8888-7777-6666-555555555555';

const HARNESS = String.raw`
param([string]$Script, [string]$Scenario, [string]$CallLog, [string]$RunId)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$PSStyle.OutputRendering = 'PlainText'
$global:S = Get-Content -LiteralPath $Scenario -Raw | ConvertFrom-Json
$global:CallLog = $CallLog
$global:Visible = [System.Collections.Generic.List[string]]::new()
foreach ($id in $global:S.preexisting) { $global:Visible.Add([string]$id) }
$global:Queue = [System.Collections.Generic.Queue[string]]::new()
foreach ($id in $global:S.dispatches) { $global:Queue.Enqueue([string]$id) }
$env:PATH = ''
function global:Log-Call([string]$line) { Add-Content -LiteralPath $global:CallLog -Value $line }
function global:fnm { '$null' }
function global:Start-Sleep { }
function global:Invoke-RestMethod { Log-Call 'health'; [pscustomobject]@{ build = [pscustomobject]@{ commitSha = $global:S.mainSha } } }
$global:CiAttempt = 0
function global:pnpm {
    Log-Call "pnpm $args"; $global:LASTEXITCODE = 0
    if ($args -contains 'ops:release-checks') {
        $index = [Math]::Min($global:CiAttempt, $global:S.ci.Count - 1)
        $response = $global:S.ci[$index]
        $global:CiAttempt++
        $global:LASTEXITCODE = $response.exitCode
        return $response.output
    }
}
function global:git {
    Log-Call "git $args"; $global:LASTEXITCODE = 0
    if ($args[0] -eq 'rev-parse') { return $global:S.mainSha }
}
function global:gh {
    Log-Call "gh $args"; $global:LASTEXITCODE = 0
    $a = @($args)
    if ($a[0] -eq 'api') { return [string]$global:S.workflowId }
    if ($a[0] -eq 'workflow' -and $a[1] -eq 'run') {
        if ($global:Queue.Count) { $global:Visible.Add($global:Queue.Dequeue()) }
        return
    }
    if ($a[0] -eq 'run' -and $a[1] -eq 'list') {
        $list = @($global:Visible | Sort-Object { [long]$_ } -Descending | ForEach-Object { $r = $global:S.runs.$_; [pscustomobject]@{ databaseId = $r.databaseId; headSha = $r.headSha } })
        return (ConvertTo-Json -InputObject $list -Depth 5 -Compress)
    }
    if ($a[0] -eq 'run' -and $a[1] -eq 'view') {
        $run = $global:S.runs.([string]$a[2])
        if ($a -contains '--log') { return @([string]$run.log -split '\r?\n') }
        return ($run | ConvertTo-Json -Depth 10 -Compress)
    }
    throw "unexpected gh $a"
}
$params = @{ CiTimeoutSeconds = $global:S.ciTimeoutSeconds }
if ($RunId) { $params.UploadRunId = $RunId }
try { & $Script @params } catch { [Console]::Out.WriteLine("FAILED: $($_.Exception.Message)"); exit 1 }
`;

type Run = Record<string, unknown>;

function uploadRun(id: number, overrides: Run = {}): Run {
	return {
		databaseId: id,
		headSha: MAIN,
		headBranch: 'main',
		event: 'workflow_dispatch',
		workflowDatabaseId: WORKFLOW_ID,
		status: 'completed',
		conclusion: 'success',
		jobs: [
			{
				databaseId: id * 10,
				name: 'Cloudflare production upload',
				conclusion: 'success',
				steps: [
					{ name: 'Upload Worker version', conclusion: 'success' },
					{ name: 'Smoke the uploaded version', conclusion: 'success' },
				],
			},
			{
				databaseId: id * 10 + 1,
				name: 'Production domain smoke',
				conclusion: 'skipped',
				steps: [],
			},
		],
		log: `upload\tUpload Worker version\tWorker Version ID: ${VERSION}\nupload\tdone`,
		...overrides,
	};
}

function domainSmokeRun(id: number): Run {
	return uploadRun(id, {
		jobs: [
			{
				databaseId: id * 10,
				name: 'Cloudflare production upload',
				conclusion: 'skipped',
				steps: [],
			},
			{
				databaseId: id * 10 + 1,
				name: 'Production domain smoke',
				conclusion: 'success',
				steps: [],
			},
		],
		log: 'smoke\tok',
	});
}

interface Scenario {
	runs: Record<string, Run>;
	preexisting?: number[];
	dispatches?: number[];
	runId?: string;
	ci?: { exitCode: number; output: string }[];
	ciTimeoutSeconds?: number;
}

const VALID_CI = { exitCode: 0, output: JSON.stringify({ sha: MAIN, state: 'CHECKS_PASSED' }) };

function runWindow({
	runs,
	preexisting = [],
	dispatches = [],
	runId = '',
	ci = [VALID_CI],
	ciTimeoutSeconds = 600,
}: Scenario) {
	const dir = mkdtempSync(join(tmpdir(), 'prod-window-'));
	try {
		const harness = join(dir, 'harness.ps1');
		const scenario = join(dir, 'scenario.json');
		const callLog = join(dir, 'calls.log');
		writeFileSync(harness, HARNESS);
		writeFileSync(callLog, '');
		writeFileSync(
			scenario,
			JSON.stringify({
				mainSha: MAIN,
				workflowId: WORKFLOW_ID,
				runs,
				preexisting,
				dispatches,
				ci,
				ciTimeoutSeconds,
			}),
		);
		const child = spawnSync(
			'pwsh',
			[
				'-NoProfile',
				'-NonInteractive',
				'-File',
				harness,
				'-Script',
				SCRIPT,
				'-Scenario',
				scenario,
				'-CallLog',
				callLog,
				'-RunId',
				runId,
			],
			{ encoding: 'utf8', timeout: 60_000 },
		);
		if (child.error) throw child.error;
		const calls = readFileSync(callLog, 'utf8').split(/\r?\n/).filter(Boolean);
		return { status: child.status, output: `${child.stdout}${child.stderr}`, calls };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

const TRAFFIC =
	/wrangler versions deploy|wrangler deployments|step=domain-smoke|prod:apply|^health$/;

function expectRejected(result: ReturnType<typeof runWindow>, message: RegExp) {
	expect(result.status).not.toBe(0);
	expect(result.output).toMatch(new RegExp(`FAILED: .*${message.source}`));
	expect(result.calls.filter((c) => TRAFFIC.test(c))).toEqual([]);
}

describe('production-daily-window upload run validation', () => {
	it.each([
		['missing', { exitCode: 1, output: '' }, /Se agotó la espera de CI/],
		['invalid JSON', { exitCode: 0, output: 'not JSON' }, /no es JSON válido/],
		[
			'wrong SHA',
			{ exitCode: 0, output: JSON.stringify({ sha: OLD, state: 'CHECKS_PASSED' }) },
			/no acredita el SHA/,
		],
		[
			'wrong state',
			{ exitCode: 0, output: JSON.stringify({ sha: MAIN, state: 'PENDING' }) },
			/no acredita el SHA/,
		],
	] as const)(
		'blocks dispatch and activation with %s CI evidence',
		(_name, response, message) => {
			const result = runWindow({ runs: {}, ci: [response], ciTimeoutSeconds: 0 });
			expectRejected(result, message);
			expect(result.calls.filter((call) => /gh workflow run/.test(call))).toEqual([]);
		},
	);

	it('waits for exact-SHA CI before dispatching the upload', () => {
		const result = runWindow({
			runs: { '200': uploadRun(200), '300': domainSmokeRun(300) },
			dispatches: [200, 300],
			ci: [{ exitCode: 1, output: '' }, VALID_CI],
		});
		expect(result.status).toBe(0);
		const checks = result.calls.filter((call) => /ops:release-checks/.test(call));
		expect(checks).toHaveLength(2);
		expect(result.calls.indexOf(checks[0])).toBeLessThan(
			result.calls.findIndex((call) => /step=upload/.test(call)),
		);
		expect(result.output).toMatch(/Esperando evidencia de CI/);
	});

	it('also requires CI when resuming a supplied upload', () => {
		const result = runWindow({
			runs: { '101': uploadRun(101) },
			runId: '101',
			ci: [{ exitCode: 1, output: '' }],
			ciTimeoutSeconds: 0,
		});
		expectRejected(result, /Se agotó la espera de CI/);
	});

	it('rejects a supplied run uploaded from a stale SHA', () => {
		const result = runWindow({
			runs: { '101': uploadRun(101, { headSha: OLD }) },
			runId: '101',
		});
		expectRejected(result, /es de b{40}, no de la main a{40}/);
	});

	it('rejects a supplied run from another workflow', () => {
		const result = runWindow({
			runs: { '101': uploadRun(101, { workflowDatabaseId: 7 }) },
			runId: '101',
		});
		expectRejected(result, /no es de deploy-production\.yml/);
	});

	it('rejects a supplied run that is not a dispatch on main', () => {
		const result = runWindow({
			runs: { '101': uploadRun(101, { headBranch: 'develop' }) },
			runId: '101',
		});
		expectRejected(result, /no es un workflow_dispatch en main/);
	});

	it('rejects a supplied run that failed', () => {
		const result = runWindow({
			runs: { '101': uploadRun(101, { conclusion: 'failure' }) },
			runId: '101',
		});
		expectRejected(result, /terminó en failure/);
	});

	it('rejects a successful domain-smoke run passed as the upload', () => {
		const result = runWindow({ runs: { '101': domainSmokeRun(101) }, runId: '101' });
		expectRejected(result, /no tiene un upload exitoso/);
	});

	it('rejects an upload whose version smoke did not succeed', () => {
		const run = uploadRun(101);
		const [upload] = run.jobs as Run[];
		upload.steps = [
			{ name: 'Upload Worker version', conclusion: 'success' },
			{ name: 'Smoke the uploaded version', conclusion: 'skipped' },
		];
		const result = runWindow({ runs: { '101': run }, runId: '101' });
		expectRejected(result, /'Smoke the uploaded version' no terminó en success/);
	});

	it('rejects an upload log without a version id or with two of them', () => {
		const missing = runWindow({
			runs: { '101': uploadRun(101, { log: 'no id here' }) },
			runId: '101',
		});
		expectRejected(missing, /tiene 0 Worker Version ID/);
		const twoIds = `Worker Version ID: ${VERSION}\nWorker Version ID: ${OTHER_VERSION}`;
		const ambiguous = runWindow({
			runs: { '101': uploadRun(101, { log: twoIds }) },
			runId: '101',
		});
		expectRejected(ambiguous, /tiene 2 Worker Version ID/);
	});

	it('activates a valid resumed upload and keeps the health check after activation', () => {
		const result = runWindow({
			runs: { '101': uploadRun(101), '300': domainSmokeRun(300) },
			dispatches: [300],
			runId: '101',
		});
		expect(result.status).toBe(0);
		expect(result.calls.filter((c) => /step=upload/.test(c))).toEqual([]);
		expect(result.calls).toContain(
			'gh run view 101 --repo fm-dev-mx/celebra-me --log --job 1010',
		);
		const deploy = result.calls.filter((c) => /wrangler versions deploy/.test(c));
		expect(deploy).toEqual([
			`pnpm exec wrangler versions deploy ${VERSION}@100% --config wrangler.jsonc --env production --yes`,
		]);
		expect(result.calls.indexOf('health')).toBeGreaterThan(result.calls.indexOf(deploy[0]));
	});

	it('picks the newly dispatched upload for main and ignores older runs', () => {
		const result = runWindow({
			runs: {
				'90': uploadRun(90, { log: `Worker Version ID: ${OTHER_VERSION}` }),
				'200': uploadRun(200),
				'300': domainSmokeRun(300),
			},
			preexisting: [90],
			dispatches: [200, 300],
		});
		expect(result.status).toBe(0);
		const deploy = result.calls.filter((c) => /wrangler versions deploy/.test(c));
		expect(deploy).toEqual([
			`pnpm exec wrangler versions deploy ${VERSION}@100% --config wrangler.jsonc --env production --yes`,
		]);
	});

	it('rejects a newly dispatched upload that does not reach the version smoke', () => {
		const run = uploadRun(200);
		const [upload] = run.jobs as Run[];
		upload.conclusion = 'failure';
		const result = runWindow({ runs: { '200': run }, dispatches: [200] });
		expectRejected(result, /no tiene un upload exitoso/);
	});
});
