#!/usr/bin/env node
/**
 * One-time import of legacy filesystem Preview approval artifacts into the
 * shared Preview DB store. Skips obsolete/stale/non-approved files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isCurrentContract, type PreviewApprovalArtifact } from './preview-approval-service.ts';
import {
	getDefaultPreviewApprovalStore,
	type PreviewApprovalStore,
} from './preview-approval-store.ts';

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function printHelp(): void {
	process.stdout.write(`
pnpm invitation:approvals:migrate — Import legacy Preview approval JSON into shared DB

Usage:
  pnpm invitation:approvals:migrate -- [--dir .agent/tmp/approvals]           # dry-run (default)
  pnpm invitation:approvals:migrate -- --apply [--dir .agent/tmp/approvals]  # write after Preview auth

Default is read-only dry-run. Explicit --apply is required for writes.
Writes require Preview authorization (TTY YES or CELEBRA_TASK_SCOPE=preview:approvals:migrate).
Only current-contract approved artifacts within the 7-day freshness window are imported.
Pending / obsolete / stale files are skipped.
`);
}

function isFreshApproved(artifact: PreviewApprovalArtifact, now: Date): boolean {
	if (artifact.approvalState !== 'approved') return false;
	if (!isCurrentContract(artifact)) return false;
	if (!artifact.approvedAt) return false;
	const approvedAtMs = Date.parse(artifact.approvedAt);
	const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
	return (
		Number.isFinite(approvedAtMs) &&
		approvedAtMs <= now.getTime() &&
		now.getTime() - approvedAtMs <= maxAgeMs
	);
}

export function migratePreviewApprovalArtifacts(input: {
	dir?: string;
	dryRun?: boolean;
	now?: Date;
	store?: PreviewApprovalStore;
}): { migrated: number; skipped: number; details: string[] } {
	const dir = resolve(process.cwd(), input.dir ?? '.agent/tmp/approvals');
	const now = input.now ?? new Date();
	const store = input.store ?? getDefaultPreviewApprovalStore();
	const details: string[] = [];
	let migrated = 0;
	let skipped = 0;

	if (!existsSync(dir)) {
		return {
			migrated: 0,
			skipped: 0,
			details: [`Directory not found: ${dir}`],
		};
	}

	const files = readdirSync(dir).filter((name) => name.startsWith('preview-approval-'));
	for (const name of files) {
		const path = join(dir, name);
		let artifact: PreviewApprovalArtifact;
		try {
			artifact = JSON.parse(readFileSync(path, 'utf8')) as PreviewApprovalArtifact;
		} catch (error) {
			skipped += 1;
			details.push(
				`skip ${name}: invalid JSON (${error instanceof Error ? error.message : String(error)})`,
			);
			continue;
		}
		if (!isFreshApproved(artifact, now)) {
			skipped += 1;
			details.push(
				`skip ${name}: ${artifact.slug ?? '?'} · ${artifact.approvalState ?? '?'} (not fresh approved current-contract)`,
			);
			continue;
		}
		if (input.dryRun) {
			migrated += 1;
			details.push(
				`dry-run ${name}: ${artifact.slug} · ${artifact.packageHash.slice(0, 16)}`,
			);
			continue;
		}
		store.upsert(artifact);
		migrated += 1;
		details.push(`migrated ${name}: ${artifact.slug} · ${artifact.packageHash.slice(0, 16)}`);
	}

	return { migrated, skipped, details };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
	if (argv.includes('--help') || argv.includes('-h')) {
		printHelp();
		return;
	}
	const apply = argv.includes('--apply');
	if (apply && argv.includes('--dry-run')) {
		throw new Error('Cannot combine --apply with --dry-run.');
	}
	const dryRun = !apply;
	if (apply) {
		const { authorizePreviewWriteApply } = await import('./preview-write-auth.ts');
		await authorizePreviewWriteApply({
			slug: 'approvals',
			operation: 'migrate',
			confirmPrompt:
				'Confirm import of legacy Preview approval artifacts into shared DB? Type YES to proceed: ',
		});
	}
	const result = migratePreviewApprovalArtifacts({
		dir: value(argv, '--dir'),
		dryRun,
	});
	for (const line of result.details) {
		process.stderr.write(`${line}\n`);
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				mode: dryRun ? 'dry-run' : 'apply',
				migrated: result.migrated,
				skipped: result.skipped,
			},
			null,
			2,
		)}\n`,
	);
}

function isMain(): boolean {
	const entry = process.argv[1];
	return typeof entry === 'string' && /preview-approval-migrate\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isMain()) {
	void main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
