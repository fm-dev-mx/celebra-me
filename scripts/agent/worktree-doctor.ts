#!/usr/bin/env tsx
/**
 * worktree-doctor.ts — Read-only worktree diagnostic command.
 *
 * Detects material configuration problems without mutating any state.
 * Safe to run at any time — never deletes, resets, or modifies user work.
 *
 * Usage: pnpm ops worktree-doctor [--deep] [--lane <path>]
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	DEPRECATED_DOT_WORKTREES_SEGMENTS,
	detectWorktreeLane,
	findRepoRoot,
	getExternalWorktreeRoot,
	listExpectedLanePaths,
} from '../shared/worktree-lane';
import { inspectLane } from './worktree-status';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Diagnosis {
	ok: boolean;
	severity: 'info' | 'warning' | 'error';
	title: string;
	detail: string;
	remediation?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// ─── Checks ────────────────────────────────────────────────────────────────────

function checkWorktreeLocation(cwd: string, repoRoot: string, diagnoses: Diagnosis[]): void {
	const normalised = cwd.replaceAll('\\', '/').toLowerCase();
	const canonicalExternalRoot = getExternalWorktreeRoot(repoRoot);

	// Check if inside .worktrees/
	const deprecatedMatch = DEPRECATED_DOT_WORKTREES_SEGMENTS.find(
		(seg) =>
			normalised.includes(`/.worktrees/${seg}`) || normalised.endsWith(`.worktrees/${seg}`),
	);

	if (deprecatedMatch) {
		diagnoses.push({
			ok: false,
			severity: 'error',
			title: 'Deprecated worktree location',
			detail: `This worktree is under the old .worktrees/ layout at "${cwd}".`,
			remediation:
				`Create a new worktree at the canonical external location:\n` +
				`  git worktree add ${canonicalExternalRoot}/${deprecatedMatch} <branch>\n` +
				`Then remove the old one:\n` +
				`  git worktree remove ${cwd}\n` +
				`See docs/core/git-governance.md for details.`,
		});
		return;
	}

	// Check if nested inside another worktree
	const repoNormalised = resolve(repoRoot).replaceAll('\\', '/').toLowerCase();
	if (normalised !== repoNormalised) {
		if (normalised.startsWith(repoNormalised + '/') || normalised.endsWith('.worktrees')) {
			const expectedPaths = listExpectedLanePaths(repoRoot);
			const isExpected = expectedPaths.some(
				(lp) => resolve(lp.path).replaceAll('\\', '/').toLowerCase() === normalised,
			);
			if (!isExpected) {
				diagnoses.push({
					ok: false,
					severity: 'warning',
					title: 'Unexpected worktree nesting',
					detail: `Worktree at "${cwd}" is nested inside the repo but not at a recognised canonical path.`,
					remediation:
						'Consider moving persistent worktrees outside the repo to the canonical\n' +
						`external root: ${canonicalExternalRoot}.`,
				});
			}
		}
	}

	// Verify it's actually a Git worktree
	if (!existsSync(resolve(cwd, 'package.json'))) {
		diagnoses.push({
			ok: false,
			severity: 'error',
			title: 'Not a valid worktree',
			detail: `Directory at "${cwd}" does not contain a package.json.`,
		});
	}
}

function checkGitWorktreeState(cwd: string, lane: ReturnType<typeof detectWorktreeLane>, diagnoses: Diagnosis[]): void {
	const status = inspectLane({
		name: lane.displayName,
		path: cwd,
		runtimeDefault: lane.runtimeDefault,
		defaultBranch: lane.id === 'integration' ? 'develop' : 'ephemeral',
	});

	if (status.inspection === 'unavailable') {
		diagnoses.push({
			ok: false,
			severity: 'error',
			title: 'Git worktree inspection unavailable',
			detail: status.diagnostics.join('; '),
			remediation: 'Resolve the Git inspection failure before claiming or mutating this lane.',
		});
		return;
	}

	if (status.state === 'dirty') {
		diagnoses.push({
			ok: false,
			severity: 'warning',
			title: 'Working tree is dirty',
			detail: `${status.modifiedCount} modified or untracked path(s) detected.`,
			remediation: 'Preserve the existing owner state; do not repurpose this lane.',
		});
	}

	if (status.relation === 'UNVERIFIED') {
		diagnoses.push({
			ok: false,
			severity: 'warning',
			title: 'Develop relation is unverified',
			detail: 'The lane could not be compared to develop.',
			remediation: 'Restore the develop ref or report the relation as UNVERIFIED.',
		});
	}
}

function checkDependencyConsistency(cwd: string, diagnoses: Diagnosis[]): void {
	const pkgPath = resolve(cwd, 'package.json');
	if (!existsSync(pkgPath)) return;
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;

	// Check lockfile exists
	const lockExists = existsSync(resolve(cwd, 'pnpm-lock.yaml'));
	if (!lockExists) {
		diagnoses.push({
			ok: false,
			severity: 'error',
			title: 'Missing pnpm-lock.yaml',
			detail: 'No lockfile found. Installations will not be deterministic.',
			remediation: 'Run: pnpm install',
		});
	}

	// Check node_modules exists
	const hasNodeModules = existsSync(resolve(cwd, 'node_modules'));
	if (!hasNodeModules) {
		diagnoses.push({
			ok: false,
			severity: 'error',
			title: 'Missing node_modules',
			detail: 'Dependencies have not been installed.',
			remediation: 'Run: pnpm install',
		});
		return;
	}

	// Check a sample of dependencies
	const allDeps: Record<string, unknown> = {
		...((pkg.dependencies as Record<string, unknown>) ?? {}),
		...((pkg.devDependencies as Record<string, unknown>) ?? {}),
	};
	const depEntries = Object.entries(allDeps);
	if (depEntries.length > 0) {
		const mismatches: string[] = [];
		for (const [dep] of depEntries.slice(0, 20)) {
			const depPath = resolve(cwd, 'node_modules', dep, 'package.json');
			if (!existsSync(depPath)) {
				mismatches.push(`${dep} (missing)`);
			}
		}
		if (mismatches.length > 5) {
			diagnoses.push({
				ok: false,
				severity: 'warning',
				title: 'Dependencies appear incomplete',
				detail: `${mismatches.length} expected packages missing from node_modules.`,
				remediation: 'Run: pnpm install',
			});
		} else {
			for (const m of mismatches) {
				diagnoses.push({
					ok: false,
					severity: 'warning',
					title: `Missing dependency: ${m}`,
					detail: `Package ${m} is declared in package.json but absent from node_modules.`,
					remediation: 'Run: pnpm install',
				});
			}
		}
	}
}

function checkEnvironmentConfiguration(
	cwd: string,
	lane: ReturnType<typeof detectWorktreeLane>,
	diagnoses: Diagnosis[],
): void {
	const envLocal = existsSync(resolve(cwd, '.env.local'));
	const envExample = existsSync(resolve(cwd, '.env.example'));
	const envPreviewLocal = existsSync(resolve(cwd, '.env.preview.local'));

	if (!envExample) {
		diagnoses.push({
			ok: false,
			severity: 'warning',
			title: 'Missing .env.example',
			detail: 'Template file .env.example is absent from this worktree.',
			remediation: 'Copy from the Integration lane: cp <repo-root>/.env.example .env.example',
		});
	}

	if (!envLocal) {
		diagnoses.push({
			ok: false,
			severity: 'warning',
			title: 'Missing .env.local',
			detail: 'No local environment file found. The Astro dev server may not start correctly.',
			remediation: 'Copy from: cp .env.example .env.local, then edit with your values.',
		});
	}

	if (lane.runtimeDefault === 'preview') {
		if (!envPreviewLocal) {
			diagnoses.push({
				ok: false,
				severity: 'error',
				title: 'Missing .env.preview.local',
				detail: 'The Preview development lane requires .env.preview.local with Preview Supabase values.',
				remediation:
					'Create from template: cp .env.preview.local.example .env.preview.local',
			});
		}
	} else if (envPreviewLocal) {
		diagnoses.push({
			ok: true,
			severity: 'info',
			title: '.env.preview.local present (unnecessary)',
			detail: `This file is present but this lane (${lane.id}) uses Local runtime. It won't be loaded unless CELEBRA_RUNTIME_TARGET=preview is explicitly set.`,
		});
	}

	// Quick remote URL check
	if (envLocal) {
		const content = readFileSync(resolve(cwd, '.env.local'), 'utf8');
		if (content.includes('supabase.co') && !content.includes('127.0.0.1')) {
			diagnoses.push({
				ok: false,
				severity: 'warning',
				title: '.env.local contains remote Supabase URL',
				detail:
					'The .env.local file appears to contain a remote (non-localhost) Supabase URL.\n' +
					'For a Local lane, this should point to http://127.0.0.1:54321.\n' +
					'For a Preview lane, remote credentials belong in .env.preview.local, not .env.local.',
				remediation:
					'Local lane: set SUPABASE_URL=http://127.0.0.1:54321 in .env.local\n' +
					'Preview lane: move Supabase values to .env.preview.local, keep .env.local for shared config.',
			});
		}
	}
}

function checkSharedGeneratedPaths(cwd: string, diagnoses: Diagnosis[]): void {
	const generatedDirs = [
		'.astro',
		'dist',
		'coverage',
		'.vercel',
		'output/playwright',
		'test-results',
		'.cache',
	];

	for (const dir of generatedDirs) {
		const dirPath = resolve(cwd, dir);
		if (existsSync(dirPath)) {
			try {
				const stats = statSync(dirPath);
				if (stats.isDirectory()) {
					diagnoses.push({
						ok: true,
						severity: 'info' as const,
						title: `Generated directory present: ${dir}`,
						detail: `"${dirPath}" exists and is local to this worktree.`,
					});
				}
			} catch {
				// stat failed — skip inaccessible paths
			}
		}
	}

	// Check for potential sharing via symlinks
	const testDirs = ['node_modules', '.astro', 'dist'];
	for (const dir of testDirs) {
		const dirPath = resolve(cwd, dir);
		if (existsSync(dirPath)) {
			try {
				const stats = statSync(dirPath);
				if (stats.isSymbolicLink()) {
					diagnoses.push({
						ok: false,
						severity: 'error' as const,
						title: `Shared/symlinked directory: ${dir}`,
						detail: `"${dirPath}" is a symlink, which may cause cross-worktree contamination.`,
						remediation: `Remove the symlink and let pnpm install create a real directory:\n  rm "${dirPath}" && pnpm install`,
					});
				}
			} catch {
				// stat error — skip
			}
		}
	}
}

function checkPortConflicts(diagnoses: Diagnosis[]): void {
	try {
		const netstat = execSync('netstat -ano | findstr ":4321 :4322 :4323 :4324"', {
			encoding: 'utf8',
			timeout: 10_000,
			stdio: ['ignore', 'pipe', 'pipe'],
		})
			.trim()
			.split('\n')
			.filter(Boolean);

		if (netstat.length > 0) {
			const listening = netstat.filter((l) => l.includes('LISTENING'));
			for (const line of listening) {
				const parts = line.trim().split(/\s+/);
				const port = parts[1]?.split(':').pop() ?? '?';
				const pid = parts[4] ?? '?';
				diagnoses.push({
					ok: true,
					severity: 'info' as const,
					title: `Port ${port} is in use (PID ${pid})`,
					detail: `${line.trim()}`,
					remediation:
						'Expected if a dev server is running. If unexpected, check for stale processes.',
				});
			}
		}
	} catch {
		// netstat not available or no matches — skip
	}
}

function checkStaleState(cwd: string, repoRoot: string, diagnoses: Diagnosis[]): void {
	// Check for old .worktrees/ directories
	const oldWorktreesPath = resolve(repoRoot, '.worktrees');
	if (existsSync(oldWorktreesPath)) {
		try {
			const children = readdirSync(oldWorktreesPath).filter((d) =>
				[
					...DEPRECATED_DOT_WORKTREES_SEGMENTS,
					'dev-extra',
					'dev-lane',
					'val-lane',
				].includes(d),
			);
			if (children.length > 0) {
				diagnoses.push({
					ok: false,
					severity: 'warning' as const,
					title: 'Stale .worktrees/ directories detected',
					detail:
						`The following directories remain under ${oldWorktreesPath}:\n` +
						children.map((c) => `  - ${c}`).join('\n'),
					remediation:
						'These are from the old worktree layout and may still have active Git worktrees.\n' +
						'Use git worktree list to check, then:\n' +
						'  1. git worktree remove <path> for each that has no uncommitted work\n' +
						'  2. rm -rf <directory> to clean up stale state after Git worktree removal',
				});
			}
		} catch {
			// readdir failed — skip
		}
	}

	// Check for symlinked node_modules
	const nmPath = resolve(cwd, 'node_modules');
	if (existsSync(nmPath)) {
		try {
			const stats = statSync(nmPath);
			if (stats.isSymbolicLink()) {
				diagnoses.push({
					ok: false,
					severity: 'error' as const,
					title: 'node_modules is a symlink',
					detail: 'node_modules is symlinked, which breaks worktree isolation.',
					remediation: 'Remove it and run pnpm install in this worktree directly.',
				});
			}
		} catch {
			// stat error — skip
		}
	}

	// Check for symlinked .astro cache
	const asPath = resolve(cwd, '.astro');
	if (existsSync(asPath)) {
		try {
			const stats = statSync(asPath);
			if (stats.isSymbolicLink()) {
				diagnoses.push({
					ok: false,
					severity: 'error' as const,
					title: '.astro cache is a symlink',
					detail: 'The .astro cache directory is symlinked, which may cause cross-worktree build contamination.',
					remediation:
						'Remove the symlink: rm .astro && pnpm build regenerates it locally.',
				});
			}
		} catch {
			// stat error — skip
		}
	}
}

// ─── Report rendering ──────────────────────────────────────────────────────────

function printDiagnosisCategory(
	label: string,
	diagnoses: Diagnosis[],
	predicate: (d: Diagnosis) => boolean,
	showInfo: boolean,
): void {
	const matches = diagnoses.filter(predicate);
	if (matches.length === 0) return;
	console.log(`\n${label}`);
	for (const d of matches) {
		if (!showInfo && d.severity === 'info') continue;
		const icon = d.ok ? '✅' : d.severity === 'warning' ? '⚠️' : '❌';
		console.log(`  ${icon} ${d.title}`);
		if (!d.ok) console.log(`     ${(d.remediation ?? d.detail).split('\n')[0]}`);
	}
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function getLanePath(cwd: string): string {
	return findRepoRoot(cwd);
}

function printDiagnosticHeader(lane: ReturnType<typeof detectWorktreeLane>, cwd: string): void {
	console.log('\n==================================================');
	console.log(' Celebra-me Worktree Doctor (Read-Only Diagnosis)');
	console.log('==================================================');
	console.log(`\n📌 Lane:   ${lane.displayName} (${lane.id})`);
	console.log(`📂 Path:   ${cwd}`);
	console.log(`🌐 Runtime: ${lane.runtimeDefault} default`);
	console.log('');
}

function printSummary(diagnoses: Diagnosis[]): void {
	const errors = diagnoses.filter((d) => d.severity === 'error');
	const warnings = diagnoses.filter((d) => d.severity === 'warning');

	console.log('\n── Summary ──');
	console.log(`  ✅ ${diagnoses.filter((d) => d.ok).length} checks passed`);
	if (warnings.length > 0) console.log(`  ⚠️  ${warnings.length} warning(s)`);
	if (errors.length > 0) console.log(`  ❌ ${errors.length} error(s)`);

	if (errors.length > 0) {
		console.log('\n--- Errors requiring remediation ---');
		for (const e of errors) {
			console.log(`\n❌ ${e.title}`);
			console.log(`   ${e.detail}`);
			if (e.remediation) console.log(`   → ${e.remediation}`);
		}
		process.exitCode = 1;
		console.log('\n❌ Worktree is unhealthy.');
	} else if (warnings.length > 0) {
		console.log('\n⚠️ Worktree is inspectable with warnings.');
	} else {
		console.log('\n✅ All checks passed — worktree is healthy.');
	}
}

function main(): void {
	const args = process.argv.slice(2);
	if (args.includes('--all')) {
		console.error('Unsupported flag --all; use --deep.');
		process.exitCode = 1;
		return;
	}
	const laneIndex = args.indexOf('--lane');
	const explicitLanePath =
		laneIndex !== -1 && args[laneIndex + 1] ? resolve(args[laneIndex + 1]!) : null;
	const checkDeep = args.includes('--deep');

	const cwd = explicitLanePath ?? process.cwd();
	const actualRepoRoot = getLanePath(cwd);
	const lane = detectWorktreeLane(cwd, actualRepoRoot);
	const diagnoses: Diagnosis[] = [];

	printDiagnosticHeader(lane, cwd);

	// Run all checks
	checkWorktreeLocation(cwd, actualRepoRoot, diagnoses);
	checkGitWorktreeState(cwd, lane, diagnoses);
	checkDependencyConsistency(cwd, diagnoses);
	checkEnvironmentConfiguration(cwd, lane, diagnoses);

	if (checkDeep) {
		checkSharedGeneratedPaths(cwd, diagnoses);
		checkPortConflicts(diagnoses);
	}

	checkStaleState(cwd, actualRepoRoot, diagnoses);

	// Print results per category
	printDiagnosisCategory(
		'── 1. Worktree Location ──',
		diagnoses,
		(d) => !!d.title.match(/^(Deprecated|Unexpected|Not a valid)/),
		false,
	);
	printDiagnosisCategory(
		'── 2. Dependencies ──',
		diagnoses,
		(d) => !!d.title.match(/^Missing/) || d.title.startsWith('Dependencies'),
		false,
	);
	printDiagnosisCategory(
		'── 3. Environment Configuration ──',
		diagnoses,
		(d) => !!d.title.match(/\.env/),
		false,
	);
	if (checkDeep) {
		printDiagnosisCategory(
			'── 4. Generated / Shared Paths ──',
			diagnoses,
			(d) => !!d.title.match(/^(Generated|Shared)/),
			false,
		);
		printDiagnosisCategory(
			'── 5. Port / Runtime Status ──',
			diagnoses,
			(d) => d.title.startsWith('Port'),
			true,
		);
	}
	printDiagnosisCategory(
		'── 6. Stale State ──',
		diagnoses,
		(d) => !!d.title.match(/^(Stale|node_modules|\.astro)/),
		false,
	);

	printSummary(diagnoses);
}

main();
