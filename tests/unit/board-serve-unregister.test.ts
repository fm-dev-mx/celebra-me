import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const SCRIPT = path.join(process.cwd(), 'scripts', 'board', 'serve-unregister.ps1');
const TASK = 'Celebra-me servidor del tablero';

/** The first PowerShell on this machine, or undefined (the suite is skipped without one). */
const SHELL = ['pwsh', 'powershell'].find(
	(cmd) => spawnSync(cmd, ['-NoProfile', '-Command', 'exit 0']).status === 0,
);

// Every Task Scheduler and process cmdlet the script calls is replaced by a function that records the
// call, so no task or process on the machine is read or changed.
const HARNESS = String.raw`
$fixture = $env:BOARD_FIXTURE | ConvertFrom-Json
$global:calls = [System.Collections.Generic.List[string]]::new()
function Get-ScheduledTask { param($TaskName, $ErrorAction) if ($fixture.registered) { [pscustomobject]@{ TaskName = $TaskName } } }
function Stop-ScheduledTask { param($TaskName) $global:calls.Add("stop-task $TaskName") }
function Unregister-ScheduledTask { param($TaskName, [switch]$Confirm) $global:calls.Add("unregister $TaskName") }
function Stop-Process { param($Id, [switch]$Confirm) $global:calls.Add("stop-process $Id") }
function New-Object {
	param($ComObject)
	$s = [pscustomobject]@{}
	$s | Add-Member ScriptMethod Connect { }
	$s | Add-Member ScriptMethod GetRunningTasks { param($flags) @($fixture.running) }
	$s
}
function Get-CimInstance {
	param($ClassName, $Filter)
	if ($Filter -notmatch "^ParentProcessId=(\d+) AND Name='node.exe'$") { throw "unexpected filter: $Filter" }
	@($fixture.processes) | Where-Object { $_.ParentProcessId -eq [int]$Matches[1] -and $_.Name -eq 'node.exe' }
}
& $env:BOARD_SCRIPT | Out-Null
ConvertTo-Json -Compress -InputObject @($global:calls.ToArray())
`;

type Fixture = {
	registered: boolean;
	running: Array<{ Name: string; EnginePID: number }>;
	processes: Array<{
		ProcessId: number;
		ParentProcessId: number;
		Name: string;
		CommandLine: string;
	}>;
};

function unregister(fixture: Fixture): string[] {
	const r = spawnSync(SHELL as string, ['-NoProfile', '-NonInteractive', '-Command', HARNESS], {
		encoding: 'utf8',
		env: { ...process.env, BOARD_FIXTURE: JSON.stringify(fixture), BOARD_SCRIPT: SCRIPT },
	});
	expect(r.stderr).toBe('');
	expect(r.status).toBe(0);
	return JSON.parse(r.stdout);
}

const manual = {
	ProcessId: 41,
	ParentProcessId: 40,
	Name: 'node.exe',
	CommandLine: 'node D:\\code\\celebra-me\\scripts\\board\\board.mjs view',
};

(SHELL ? describe : describe.skip)('serve-unregister.ps1', () => {
	it('stops nothing when the task is not registered, not even an absolute-path server', () => {
		expect(unregister({ registered: false, running: [], processes: [manual] })).toEqual([]);
	});

	it('stops only the node child of the running task, also under a quoted path with spaces', () => {
		const child = {
			ProcessId: 61,
			ParentProcessId: 60,
			Name: 'node.exe',
			CommandLine:
				'"C:\\Program Files\\nodejs\\node.exe" "D:\\my repo\\scripts\\board\\board.mjs" view',
		};
		const calls = unregister({
			registered: true,
			running: [{ Name: TASK, EnginePID: 60 }],
			processes: [manual, child],
		});
		expect(calls).toEqual([`stop-task ${TASK}`, `unregister ${TASK}`, 'stop-process 61']);
	});

	it('removes a registered task that is not running without stopping any process', () => {
		const calls = unregister({
			registered: true,
			running: [{ Name: 'Otra tarea', EnginePID: 40 }],
			processes: [manual],
		});
		expect(calls).toEqual([`stop-task ${TASK}`, `unregister ${TASK}`]);
	});
});
