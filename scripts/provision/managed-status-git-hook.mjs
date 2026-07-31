/**
 * Non-blocking Git hook entry for compact managed status.
 * Never fails the Git operation. Opt out with CELEBRA_SKIP_MANAGED_STATUS=1.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OPT_OUT = 'CELEBRA_SKIP_MANAGED_STATUS';
const HOOK_TIMEOUT_MS = 4_000;

function optedOut() {
	const raw = process.env[OPT_OUT]?.trim().toLowerCase();
	return raw === '1' || raw === 'true' || raw === 'yes';
}

function main() {
	if (optedOut()) {
		process.exit(0);
	}

	const here = dirname(fileURLToPath(import.meta.url));
	const cli = resolve(here, 'dbs-cli.ts');
	const tsxCli = resolve(here, '../../node_modules/tsx/dist/cli.mjs');
	const child = spawn(process.execPath, [tsxCli, cli, '--compact', '--timeout-ms', '2500'], {
		cwd: resolve(here, '../..'),
		env: {
			...process.env,
			PGCONNECT_TIMEOUT: '2',
			PGOPTIONS: '-c statement_timeout=2500',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});

	let settled = false;
	const finish = (code = 0) => {
		if (settled) return;
		settled = true;
		process.exit(code);
	};

	const timer = setTimeout(() => {
		child.kill();
		process.stderr.write(
			'[managed-status] timed out (read-only; Git continues). Set CELEBRA_SKIP_MANAGED_STATUS=1 to opt out.\n',
		);
		finish(0);
	}, HOOK_TIMEOUT_MS);

	child.stdout?.on('data', (chunk) => {
		process.stdout.write(chunk);
	});
	child.stderr?.on('data', (chunk) => {
		const text = chunk.toString('utf8');
		// Suppress noisy stack traces for expected credential/network gaps.
		if (
			/ECONNREFUSED|password authentication failed|could not connect|CREDENTIALS_REQUIRED|not configured/i.test(
				text,
			)
		) {
			process.stderr.write('[managed-status] remote environment unavailable (degraded).\n');
			return;
		}
		process.stderr.write(text);
	});
	child.on('error', () => {
		clearTimeout(timer);
		finish(0);
	});
	child.on('close', () => {
		clearTimeout(timer);
		finish(0);
	});
}

main();
