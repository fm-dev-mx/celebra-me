#!/usr/bin/env tsx
/**
 * worktree-doctor.ts — Read-only worktree diagnostic command.
 *
 * Detects material configuration problems without mutating any state.
 * Safe to run at any time — never deletes, resets, or modifies user work.
 *
 * Usage: pnpm ops worktree-doctor [--lane <path>]
 */

import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	detectWorktreeLane,
	findRepoRoot,
	getExternalWorktreeRoot,
	type WorktreeLaneDefinition,
} from '../shared/worktree-lane';
import { inspectLane } from './worktree-status';

type Category = 'Location' | 'Git state' | 'Dependencies' | 'Environment';

interface Finding {
	category: Category;
	severity: 'warning' | 'error';
	title: string;
	remediation: string;
}

function checkLocation(cwd: string, repoRoot: string, lane: WorktreeLaneDefinition): Finding[] {
	if (!existsSync(resolve(cwd, 'package.json'))) {
		return [
			{
				category: 'Location',
				severity: 'error',
				title: 'Not a valid worktree: package.json is missing',
				remediation: 'Run from a lane root or pass --lane <path>.',
			},
		];
	}
	if (lane.id !== 'unknown') return [];
	return [
		{
			category: 'Location',
			severity: 'warning',
			title: 'Not a canonical lane path',
			remediation: `Use the repository root or a lane under ${getExternalWorktreeRoot(repoRoot)}.`,
		},
	];
}

function checkGitState(cwd: string, lane: WorktreeLaneDefinition): Finding[] {
	const status = inspectLane({
		name: lane.displayName,
		path: cwd,
		runtimeDefault: lane.runtimeDefault,
	});
	if (status.inspection === 'unavailable') {
		return [
			{
				category: 'Git state',
				severity: 'error',
				title: `Git inspection unavailable: ${status.diagnostics.join('; ')}`,
				remediation: 'Resolve the Git failure before claiming or mutating this lane.',
			},
		];
	}
	const findings: Finding[] = [];
	if (status.state === 'dirty') {
		findings.push({
			category: 'Git state',
			severity: 'warning',
			title: `Working tree is dirty (${status.modifiedCount} path(s))`,
			remediation: 'Preserve the existing owner state; do not repurpose this lane.',
		});
	}
	if (status.relation === 'UNVERIFIED') {
		findings.push({
			category: 'Git state',
			severity: 'warning',
			title: 'Relation to develop is unverified',
			remediation: 'Restore the develop ref, then rerun.',
		});
	}
	return findings;
}

function checkDependencies(cwd: string): Finding[] {
	const install = 'Run: pnpm install';
	const findings: Finding[] = [];
	if (!existsSync(resolve(cwd, 'pnpm-lock.yaml'))) {
		findings.push({
			category: 'Dependencies',
			severity: 'error',
			title: 'Missing pnpm-lock.yaml',
			remediation: install,
		});
	}
	const nodeModules = resolve(cwd, 'node_modules');
	if (!existsSync(nodeModules)) {
		findings.push({
			category: 'Dependencies',
			severity: 'error',
			title: 'Missing node_modules',
			remediation: install,
		});
		return findings;
	}
	if (lstatSync(nodeModules).isSymbolicLink()) {
		findings.push({
			category: 'Dependencies',
			severity: 'error',
			title: 'node_modules is a symlink, which breaks worktree isolation',
			remediation: 'Remove the link and run pnpm install in this worktree.',
		});
	}

	const pkgPath = resolve(cwd, 'package.json');
	if (!existsSync(pkgPath)) return findings;
	let pkg: {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	try {
		pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
	} catch {
		findings.push({
			category: 'Dependencies',
			severity: 'error',
			title: 'Malformed package.json (invalid JSON syntax)',
			remediation: 'Fix the JSON syntax in package.json.',
		});
		return findings;
	}
	const missing = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
		(dep) => !existsSync(resolve(nodeModules, dep, 'package.json')),
	);
	if (missing.length > 0) {
		findings.push({
			category: 'Dependencies',
			severity: 'warning',
			title: `${missing.length} declared package(s) missing: ${missing.slice(0, 5).join(', ')}`,
			remediation: install,
		});
	}
	return findings;
}

function checkEnvironment(cwd: string, lane: WorktreeLaneDefinition): Finding[] {
	const findings: Finding[] = [];
	const envLocal = resolve(cwd, '.env.local');
	if (!existsSync(envLocal)) {
		findings.push({
			category: 'Environment',
			severity: 'warning',
			title: 'Missing .env.local',
			remediation: 'Copy .env.example to .env.local and fill in Local values.',
		});
	} else {
		const content = readFileSync(envLocal, 'utf8');
		if (content.includes('supabase.co') && !content.includes('127.0.0.1')) {
			findings.push({
				category: 'Environment',
				severity: 'warning',
				title: '.env.local points at a remote Supabase URL',
				remediation:
					'Keep Local values in .env.local; Preview values belong in .env.preview.local.',
			});
		}
	}
	if (lane.runtimeDefault === 'preview' && !existsSync(resolve(cwd, '.env.preview.local'))) {
		findings.push({
			category: 'Environment',
			severity: 'error',
			title: 'Missing .env.preview.local (required by the Preview lane)',
			remediation: 'Copy .env.preview.local.example to .env.preview.local.',
		});
	}
	return findings;
}

function printReport(findings: Finding[]): void {
	const categories: Category[] = ['Location', 'Git state', 'Dependencies', 'Environment'];
	for (const category of categories) {
		const matches = findings.filter((finding) => finding.category === category);
		console.log(`\n── ${category} ──`);
		if (matches.length === 0) console.log('  ✅ OK');
		for (const finding of matches) {
			console.log(`  ${finding.severity === 'error' ? '❌' : '⚠️'} ${finding.title}`);
			console.log(`     → ${finding.remediation}`);
		}
	}

	const errors = findings.filter((finding) => finding.severity === 'error').length;
	const warnings = findings.length - errors;
	if (errors > 0) {
		process.exitCode = 1;
		console.log(`\n❌ Worktree is unhealthy: ${errors} error(s), ${warnings} warning(s).`);
	} else if (warnings > 0) {
		console.log(`\n⚠️ Worktree is usable with ${warnings} warning(s).`);
	} else {
		console.log('\n✅ Worktree is healthy.');
	}
}

function main(): void {
	const args = process.argv.slice(2);
	const laneIndex = args.indexOf('--lane');
	const cwd =
		laneIndex !== -1 && args[laneIndex + 1] ? resolve(args[laneIndex + 1]!) : process.cwd();
	const repoRoot = findRepoRoot(cwd);
	const lane = detectWorktreeLane(cwd, repoRoot);

	console.log('\nCelebra-me Worktree Doctor (read-only)');
	console.log(`  Lane:    ${lane.displayName} (${lane.id})`);
	console.log(`  Path:    ${cwd}`);
	console.log(`  Runtime: ${lane.runtimeDefault} default`);

	printReport([
		...checkLocation(cwd, repoRoot, lane),
		...checkGitState(cwd, lane),
		...checkDependencies(cwd),
		...checkEnvironment(cwd, lane),
	]);
}

main();
