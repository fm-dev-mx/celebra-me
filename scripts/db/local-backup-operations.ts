import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { runCommand } from './db-workflow-lib.ts';

const CRITICAL_DIRECTORY_PATTERN = /^critical-(\d{4})-(\d{2})-(\d{2})T/;

export interface RetentionCandidate {
	path: string;
	createdAt: Date;
}

export interface RetentionPlan {
	keep: RetentionCandidate[];
	remove: RetentionCandidate[];
}

function assertCriticalBackupChild(root: string, candidate: string): void {
	const resolvedRoot = resolve(root);
	const resolvedCandidate = resolve(candidate);
	if (
		dirname(resolvedCandidate) !== resolvedRoot ||
		!CRITICAL_DIRECTORY_PATTERN.test(basename(resolvedCandidate))
	) {
		throw new Error('Refusing retention operation outside the critical backup root.');
	}
}

export function prepareEncryptedLocalDirectory(path: string): void {
	if (process.platform !== 'win32') {
		throw new Error(
			'The canonical local backup workflow currently requires Windows EFS on the authorized operator machine.',
		);
	}
	const result = runCommand('cipher.exe', ['/E', '/A', '/B', resolve(path)], {
		throwOnError: false,
	});
	if (result.status !== 0) {
		throw new Error('Windows EFS could not encrypt the local backup directory.');
	}
}

export function assertWindowsEfsEncrypted(paths: string[]): void {
	if (process.platform !== 'win32') {
		throw new Error('Windows EFS verification is unavailable on this operator platform.');
	}
	for (const path of paths) {
		const result = runCommand('cipher.exe', ['/C', '/A', resolve(path)], {
			throwOnError: false,
		});
		if (result.status !== 0 || !/^\s*E\s+/m.test(result.stdout)) {
			throw new Error(`Local backup encryption verification failed: ${basename(path)}`);
		}
	}
}

export function listCriticalBackups(root: string): RetentionCandidate[] {
	const resolvedRoot = resolve(root);
	return readdirSync(resolvedRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && CRITICAL_DIRECTORY_PATTERN.test(entry.name))
		.map((entry) => {
			const path = resolve(resolvedRoot, entry.name);
			assertCriticalBackupChild(resolvedRoot, path);
			return { path, createdAt: statSync(path).birthtime };
		})
		.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function planCriticalBackupRetention(
	candidates: RetentionCandidate[],
	dailyCount = 30,
	monthlyCount = 12,
): RetentionPlan {
	if (!Number.isInteger(dailyCount) || dailyCount < 1) {
		throw new Error('Daily retention count must be a positive integer.');
	}
	if (!Number.isInteger(monthlyCount) || monthlyCount < 0) {
		throw new Error('Monthly retention count must be a non-negative integer.');
	}
	const sorted = [...candidates].sort(
		(left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
	);
	const keptPaths = new Set(sorted.slice(0, dailyCount).map((candidate) => candidate.path));
	const monthlyKeys = new Set<string>();
	for (const candidate of sorted.slice(dailyCount)) {
		if (monthlyKeys.size >= monthlyCount) break;
		const key = `${candidate.createdAt.getUTCFullYear()}-${String(
			candidate.createdAt.getUTCMonth() + 1,
		).padStart(2, '0')}`;
		if (monthlyKeys.has(key)) continue;
		monthlyKeys.add(key);
		keptPaths.add(candidate.path);
	}
	return {
		keep: sorted.filter((candidate) => keptPaths.has(candidate.path)),
		remove: sorted.filter((candidate) => !keptPaths.has(candidate.path)),
	};
}

export function applyCriticalBackupRetention(root: string, plan: RetentionPlan): void {
	const resolvedRoot = resolve(root);
	for (const candidate of plan.remove) {
		assertCriticalBackupChild(resolvedRoot, candidate.path);
		rmSync(candidate.path, { recursive: true, force: true });
	}
}

/** Remove kill-orphaned critical-* directories that never wrote a manifest. */
export function removeIncompleteCriticalBackups(root: string): string[] {
	const resolvedRoot = resolve(root);
	if (!existsSync(resolvedRoot)) return [];
	const removed: string[] = [];
	for (const candidate of listCriticalBackups(resolvedRoot)) {
		if (existsSync(join(candidate.path, 'manifest.json'))) continue;
		assertCriticalBackupChild(resolvedRoot, candidate.path);
		rmSync(candidate.path, { recursive: true, force: true });
		removed.push(candidate.path);
	}
	return removed;
}
