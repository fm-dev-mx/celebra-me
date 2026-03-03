#!/usr/bin/env node

import { spawnSync } from 'child_process';

const MAX_ATTEMPTS = 3;

function run(cmd, args, options = {}) {
	const res = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: false,
		stdio: 'pipe',
		...options,
	});
	if (res.error) throw res.error;
	return {
		status: res.status ?? 1,
		stdout: String(res.stdout || ''),
		stderr: String(res.stderr || ''),
	};
}

function fail(message) {
	console.error(`❌ ${message}`);
	process.exit(1);
}

function parseReport(raw) {
	const txt = String(raw || '').trim();
	const start = txt.indexOf('{');
	const end = txt.lastIndexOf('}');
	if (start < 0 || end < 0 || end <= start) {
		throw new Error('Gatekeeper report JSON was not found in output.');
	}
	return JSON.parse(txt.slice(start, end + 1));
}

function runGatekeeperReport() {
	const res = run('node', [
		'scripts/gatekeeper.js',
		'--mode',
		'strict',
		'--report-json',
		'--secret-scan-staged',
		'--require-complete-report',
	]);
	const report = parseReport(res.stdout);
	return { report, status: res.status, stderr: res.stderr };
}

function uniqueFixCommands(report) {
	const findings = report?.governance?.findings || [];
	return [
		...new Set(
			findings.filter((f) => f?.autoFixable && f?.fixCommand).map((f) => f.fixCommand),
		),
	];
}

function runFixCommand(command) {
	console.log(`🛠️ Running auto-fix: ${command}`);
	const isWin = process.platform === 'win32';
	const parts = command.split(' ').filter(Boolean);
	let cmd = parts[0];
	const args = parts.slice(1);

	// On Windows, if shell is false, we need the exact extension.
	// But using shell: true is generally more reliable for npm/pnpm/npx.
	const res = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: isWin,
		stdio: 'inherit',
	});
	const status = res.status ?? 1;
	if (status !== 0) {
		console.error(`❌ Fix command failed with status ${status}: ${command}`);
	}
	return status === 0;
}

function printBlockingSummary(report) {
	const blockers = report?.blockingFindings || [];
	if (!blockers.length) return;
	console.error('Blocking findings:');
	for (const b of blockers) {
		const loc = b.file ? `${b.file}${b.line ? `:${b.line}` : ''}` : '(global)';
		console.error(`- [${b.ruleId}] ${loc} ${b.message}`);
	}
}

function main() {
	console.log('🚦 Starting deterministic Gatekeeper workflow...');
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		console.log(`\nAttempt ${attempt}/${MAX_ATTEMPTS}`);
		const { report } = runGatekeeperReport();
		if (report?.branch?.changed) {
			console.log(`🌿 Auto-switched branch: ${report.branch.from} -> ${report.branch.to}`);
		}
		if (report.route === 'proceed_adu') {
			console.log('✅ Gatekeeper passed. You can run: git commit');
			process.exit(0);
		}

		const fixCommands = uniqueFixCommands(report);
		if (!fixCommands.length) {
			printBlockingSummary(report);
			fail(`Gatekeeper route is "${report.route}" and no auto-fix commands are available.`);
		}

		let allFixesOk = true;
		for (const fix of fixCommands) {
			if (!runFixCommand(fix)) allFixesOk = false;
		}
		if (!allFixesOk) {
			fail('One or more auto-fix commands failed.');
		}
	}

	const { report } = runGatekeeperReport();
	printBlockingSummary(report);
	fail('Gatekeeper did not converge to proceed_adu after max attempts.');
}

main();
