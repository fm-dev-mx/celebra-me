#!/usr/bin/env tsx
/**
 * worktree-bootstrap.ts — Canonical worktree bootstrap command.
 *
 * Validates the current lane and optionally installs dependencies deterministically.
 * Default mode is read-only; use --apply for pnpm install.
 *
 * Usage: pnpm ops worktree-bootstrap [--lane <path>] [--apply]
 *
 * This command does NOT mutate Git history, environment variables, or database state.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	DEPRECATED_DOT_WORKTREES_SEGMENTS,
	detectWorktreeLane,
	findRepoRoot,
	getExternalWorktreeRoot,
} from '../shared/worktree-lane';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function runCmd(cmd: string, cwd: string): { stdout: string; exitCode: number } {
	try {
		const stdout = execSync(cmd, {
			cwd,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			timeout: 300_000,
		}).trim();
		return { stdout, exitCode: 0 };
	} catch (e) {
		const err = e as { stdout?: Buffer; status?: number };
		return {
			stdout: (err.stdout ?? '').toString().trim(),
			exitCode: err.status ?? 1,
		};
	}
}

function checkTool(tool: string, args: string[] = ['--version']): boolean {
	try {
		execSync(`${tool} ${args.join(' ')}`, {
			stdio: ['ignore', 'pipe', 'ignore'],
			encoding: 'utf8',
			timeout: 10_000,
		});
		return true;
	} catch {
		return false;
	}
}

function satisfiesSemver(version: string, constraint: string): boolean {
	const parse = (v: string) =>
		v
			.replace(/^[~^>=<]/, '')
			.split('.')
			.map(Number);
	const actual = parse(version);
	const required = parse(constraint);
	for (let i = 0; i < 3; i++) {
		const a = actual[i] ?? 0;
		const r = required[i] ?? 0;
		if (a > r) return true;
		if (a < r) return false;
	}
	return true;
}

// ─── Validation ────────────────────────────────────────────────────────────────

interface ValidationResult {
	ok: boolean;
	message: string;
	action: string;
}

function validateNodeVersion(pkg: Record<string, unknown>): ValidationResult {
	const range = (pkg.engines as Record<string, string> | undefined)?.node;
	if (!range)
		return { ok: true, message: 'No node engine constraint in package.json', action: '' };

	const nodeVersion = process.version.slice(1); // strip 'v'
	const parts = range.split(/\s+/);
	for (const part of parts) {
		if (part.startsWith('>=')) {
			if (!satisfiesSemver(nodeVersion, part.replace('>=', ''))) {
				return {
					ok: false,
					message: `Node ${nodeVersion} does not satisfy ${range}`,
					action: `Install Node ${part.replace('>=', '')}+ (current: ${nodeVersion})`,
				};
			}
		}
		if (part.startsWith('<')) {
			if (!satisfiesSemver(part.replace('<', ''), nodeVersion)) {
				return {
					ok: false,
					message: `Node ${nodeVersion} does not satisfy ${range}`,
					action: `Downgrade Node to < ${part.replace('<', '')} (current: ${nodeVersion})`,
				};
			}
		}
	}
	return { ok: true, message: `Node ${nodeVersion} satisfies ${range}`, action: '' };
}

function validatePnpmVersion(
	pkg: Record<string, unknown>,
	installedVersion: string,
): ValidationResult {
	const pinned = (pkg.packageManager as string) ?? '';
	if (!pinned)
		return { ok: true, message: 'No packageManager field in package.json', action: '' };

	const match = pinned.match(/pnpm@(\d+\.\d+\.\d+)/);
	if (!match?.[1]) {
		return { ok: true, message: `Cannot parse packageManager from: ${pinned}`, action: '' };
	}

	const expected = match[1];
	const actual = installedVersion.trim();

	if (actual === expected) {
		return {
			ok: true,
			message: `pnpm ${actual} matches pinned version ${expected}`,
			action: '',
		};
	}

	return {
		ok: false,
		message: `pnpm ${actual} does not match pinned version ${expected}`,
		action: `Run: corepack enable && corepack prepare pnpm@${expected} --activate`,
	};
}

// ─── Location checks ───────────────────────────────────────────────────────────

function isDeprecatedLocation(cwd: string): boolean {
	const normalised = cwd.replaceAll('\\', '/').toLowerCase();
	return DEPRECATED_DOT_WORKTREES_SEGMENTS.some(
		(seg) =>
			normalised.includes(`/.worktrees/${seg}`) || normalised.endsWith(`.worktrees/${seg}`),
	);
}

function validateLocation(cwd: string, repoRoot: string): boolean {
	if (isDeprecatedLocation(cwd)) {
		console.warn(
			'\n⚠️  WARNING: This worktree is at a deprecated location under `.worktrees/`.\n' +
				'   Create a new worktree at the canonical external location:\n' +
				`     ${getExternalWorktreeRoot(repoRoot)}/<lane>\n` +
				'   See docs/core/git-governance.md for migration instructions.',
		);
		return false;
	}

	if (!existsSync(resolve(cwd, '.git')) || !existsSync(resolve(cwd, 'package.json'))) {
		console.error('\n❌ Not a valid worktree: missing .git or package.json');
		return false;
	}

	return true;
}

// ─── Main (split into smaller functions for complexity limit) ──────────────────

function validateEnvironment(pkg: Record<string, unknown>, cwd: string): boolean {
	console.log('\n--- Environment ---');
	let ok = true;

	const nodeCheck = validateNodeVersion(pkg);
	console.log(`  ${nodeCheck.ok ? '✅' : '❌'} ${nodeCheck.message}`);
	if (!nodeCheck.ok) {
		console.error(`     Action: ${nodeCheck.action}`);
		ok = false;
	}

	const pnpmVersionRaw = runCmd('pnpm --version', cwd);
	const pnpmVersion = pnpmVersionRaw.stdout || '(not found)';
	const pnpmCheck = validatePnpmVersion(pkg, pnpmVersion);
	console.log(`  ${pnpmCheck.ok ? '✅' : '❌'} ${pnpmCheck.message}`);
	if (!pnpmCheck.ok) {
		console.error(`     Action: ${pnpmCheck.action}`);
		ok = false;
	}

	const hasPnpm = checkTool('pnpm');
	console.log(`  ${hasPnpm ? '✅' : '❌'} pnpm available on PATH`);
	if (!hasPnpm) {
		console.error('     Action: Install pnpm via corepack or npm i -g pnpm');
		ok = false;
	}

	return ok;
}

function installDependencies(cwd: string): boolean {
	console.log('\n--- Dependencies ---');

	const hasNodeModules = existsSync(resolve(cwd, 'node_modules'));
	if (hasNodeModules) {
		const pkgPath = resolve(cwd, 'package.json');
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
		const deps = pkg.dependencies as Record<string, string> | undefined;
		const topDeps = Object.keys(deps ?? {});
		const sampleDep = topDeps[0];

		if (sampleDep && !existsSync(resolve(cwd, 'node_modules', sampleDep))) {
			console.log('     ⚠️  node_modules appears stale — re-running pnpm install...');
		} else {
			console.log('  ✅ node_modules looks healthy');
		}
	} else {
		console.log('  ℹ️  node_modules missing — running pnpm install...');
	}

	console.log('\n  Running pnpm install...');
	const installResult = runCmd('pnpm install', cwd);
	if (installResult.exitCode === 0) {
		console.log('  ✅ pnpm install completed successfully');
		return true;
	}
	console.error(`  ❌ pnpm install failed (exit ${installResult.exitCode})`);
	console.error(`     ${installResult.stdout.slice(0, 500)}`);
	return false;
}

function checkEnvFiles(cwd: string, lane: ReturnType<typeof detectWorktreeLane>): boolean {
	console.log('\n--- Environment Files ---');
	let ok = true;

	const envLocal = existsSync(resolve(cwd, '.env.local'));
	const envExample = existsSync(resolve(cwd, '.env.example'));
	const envPreviewLocal = existsSync(resolve(cwd, '.env.preview.local'));

	console.log(`  ${envExample ? '✅' : '⚠️'} .env.example`);
	console.log(`  ${envLocal ? '✅' : '⚠️'} .env.local`);

	if (lane.runtimeDefault === 'preview') {
		console.log(
			`  ${envPreviewLocal ? '✅' : '❌'} .env.preview.local (REQUIRED for Preview lane)`,
		);
		if (!envPreviewLocal) {
			console.error('     Action: Create .env.preview.local with Preview SUPABASE_* values');
			console.error('     Template: cp .env.preview.local.example .env.preview.local');
			ok = false;
		}
	} else {
		console.log(
			`  ${envPreviewLocal ? 'ℹ️' : '—'} .env.preview.local ${envPreviewLocal ? '(present but not required)' : '(not present)'}`,
		);
	}

	return ok;
}

function printSummary(lane: ReturnType<typeof detectWorktreeLane>, cwd: string, ok: boolean): void {
	console.log('\n--- Summary ---');
	if (ok) {
		console.log('✅ Worktree bootstrap complete.');
	} else {
		console.log('❌ Bootstrap completed with issues — see above for remediation steps.');
	}

	console.log(`\n📋 Lane: ${lane.displayName}`);
	console.log(`   Path: ${cwd}`);
	console.log(`   Runtime default: ${lane.runtimeDefault}`);
}

function main(): void {
	const args = process.argv.slice(2);
	const laneIndex = args.indexOf('--lane');
	const explicitLanePath =
		laneIndex !== -1 && args[laneIndex + 1] ? resolve(args[laneIndex + 1]!) : null;

	const cwd = explicitLanePath ?? process.cwd();
	const actualRepoRoot = findRepoRoot(cwd);
	const lane = detectWorktreeLane(cwd, actualRepoRoot);

	console.log('\n=== Worktree Bootstrap ===\n');
	console.log(`📌 Lane:      ${lane.displayName} (${lane.id})`);
	console.log(`📂 Path:      ${cwd}`);

	// Validate location
	if (!validateLocation(cwd, actualRepoRoot)) {
		process.exitCode = 1;
		return;
	}

	// Load package.json
	const pkgPath = resolve(cwd, 'package.json');
	if (!existsSync(pkgPath)) {
		console.error('\n❌ package.json not found in worktree');
		process.exitCode = 1;
		return;
	}
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;

	// Validate environment
	const envOk = validateEnvironment(pkg, cwd);
	if (!envOk) process.exitCode = 1;

	// Install dependencies
	const apply = args.includes('--apply');
	let depsOk = true;
	if (apply) {
		depsOk = installDependencies(cwd);
	} else {
		console.log(
			'\n--- Dependencies (Read-Only) ---\n  ℹ️  Skipping pnpm install; rerun with --apply to mutate dependencies.',
		);
	}
	if (!depsOk) process.exitCode = 1;

	// Check env files
	const filesOk = checkEnvFiles(cwd, lane);
	if (!filesOk) process.exitCode = 1;

	// Summary
	const allOk = envOk && depsOk && filesOk;
	printSummary(lane, cwd, allOk);
	if (!allOk) process.exitCode = 1;
}

main();
