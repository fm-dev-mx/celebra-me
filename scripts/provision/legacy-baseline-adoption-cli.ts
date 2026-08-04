/**
 * CLI boundary for legacy baseline adoption preparation and metadata-only apply.
 *
 * Writes are limited to managed provenance + mutation receipts (never invitation
 * content). Recovery evidence is a bounded pre-write snapshot — not a full
 * critical Production backup.
 *
 * Pending until all LEGACY_BASELINE_ADOPTION_SLUGS are adopted or explicitly
 * excluded (Goal 4 retirement condition).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { exportInvitationPackage } from './invitation-package.ts';
import {
	applyLegacyBaselineAdoption,
	captureLegacyBaselinePreWriteSnapshot,
	createLegacyBaselineAdoptionManifest,
	dryRunLegacyBaselineAdoption,
	LEGACY_BASELINE_ADOPTION_SLUGS,
	readLegacyAdoptionCandidate,
	type LegacyBaselineAdoptionManifest,
	type LegacyBaselinePreWriteSnapshot,
} from './legacy-baseline-adoption.ts';
import { getProdDbUrl } from '../db/db-workflow-lib.ts';
import { requireOwnerProductionApply } from '../db/owner-production-apply.ts';

interface CliOptions {
	manifestPath?: string;
	outPath?: string;
	dryRun: boolean;
	apply: boolean;
	manifestFingerprint?: string;
	recoverySnapshotPath?: string;
	json: boolean;
}

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function parseOptions(args: string[]): CliOptions {
	const manifestPath = value(args, '--manifest');
	const outPath = value(args, '--out');
	const manifestFingerprint = value(args, '--manifest-fingerprint');
	const recoverySnapshotPath = value(args, '--recovery-snapshot');
	if ((manifestPath && outPath) || (args.includes('--dry-run') && !manifestPath)) {
		throw new Error('Use --out to generate, or --manifest together with --dry-run or --apply.');
	}
	if (args.includes('--apply') && !manifestPath) {
		throw new Error('Apply is not authorized without an existing manifest path.');
	}
	return {
		manifestPath,
		outPath,
		dryRun: args.includes('--dry-run'),
		apply: args.includes('--apply'),
		manifestFingerprint,
		recoverySnapshotPath,
		json: args.includes('--json'),
	};
}

function readManifest(path: string): LegacyBaselineAdoptionManifest {
	return JSON.parse(readFileSync(path, 'utf8')) as LegacyBaselineAdoptionManifest;
}

async function inspect(): Promise<LegacyBaselineAdoptionManifest> {
	const packages = await Promise.all(
		LEGACY_BASELINE_ADOPTION_SLUGS.map(
			async (slug) =>
				(
					await exportInvitationPackage({
						slug,
						sourceDir: `src/assets/invitations/${slug}`,
						dryRun: true,
					})
				).packageData,
		),
	);
	const candidates = LEGACY_BASELINE_ADOPTION_SLUGS.map((slug) => ({
		local: readLegacyAdoptionCandidate({ environment: 'local', slug }) ?? undefined,
		preview: readLegacyAdoptionCandidate({ environment: 'preview', slug }) ?? undefined,
		production: readLegacyAdoptionCandidate({ environment: 'production', slug }) ?? undefined,
	}));
	return createLegacyBaselineAdoptionManifest({ packages, candidates });
}

function commandFor(path: string, fingerprint: string): LegacyBaselineAdoptionManifest['commands'] {
	const quoted = JSON.stringify(path);
	return {
		dryRun: `pnpm invitation:legacy-baseline-adoption -- --manifest ${quoted} --dry-run --json`,
		futureApply: `pnpm invitation:legacy-baseline-adoption -- --manifest ${quoted} --manifest-fingerprint ${fingerprint} --recovery-snapshot <prewrite-snapshot.json> --apply --json`,
	};
}

function writeManifest(path: string, manifest: LegacyBaselineAdoptionManifest): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function writeSnapshot(path: string, snapshot: LegacyBaselinePreWriteSnapshot): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

function present(value: unknown, json: boolean): void {
	console.log(JSON.stringify(value, null, json ? undefined : 2));
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const options = parseOptions(args);
	const existingPath = options.manifestPath
		? resolve(process.cwd(), options.manifestPath)
		: undefined;
	const manifest = existingPath ? readManifest(existingPath) : await inspect();
	const manifestPath =
		existingPath ??
		resolve(
			process.cwd(),
			options.outPath ?? '.agent/tmp/adoptions/legacy-baseline-adoption-manifest.json',
		);
	const bound = { ...manifest, commands: commandFor(manifestPath, manifest.manifestFingerprint) };

	if (!existingPath) {
		writeManifest(manifestPath, bound);
		present(
			{
				status: 'GENERATED',
				manifestPath,
				manifestFingerprint: bound.manifestFingerprint,
				entries: bound.entries.map((entry) => ({ slug: entry.slug, status: entry.status })),
				writes: 0,
			},
			options.json,
		);
		return;
	}
	if (options.apply) {
		const { url: productionDbUrl } = getProdDbUrl();
		const snapshot = captureLegacyBaselinePreWriteSnapshot({
			manifest: bound,
			dbUrl: productionDbUrl,
		});
		const snapshotPath = resolve(
			process.cwd(),
			options.recoverySnapshotPath ??
				`.agent/tmp/adoptions/legacy-baseline-prewrite-${bound.manifestFingerprint.slice(0, 12)}.json`,
		);
		writeSnapshot(snapshotPath, snapshot);
		if (snapshot.scope.length === 0) {
			throw new Error(
				'RECOVERY_SNAPSHOT: no ELIGIBLE entries in manifest; refusing apply with empty recovery scope.',
			);
		}
		const scope = snapshot.scope.join(',');
		requireOwnerProductionApply({
			apply: true,
			dbUrl: productionDbUrl,
			operationType: 'legacy_baseline_adoption',
			confirmationChallenge: `ADOPT_BASELINE ${bound.manifestFingerprint}`,
			summary: [
				['Mode', 'legacy baseline adoption (metadata-only)'],
				['Scope', scope],
				['Fingerprint', bound.manifestFingerprint],
				['Recovery snapshot', snapshotPath],
			],
		});
		const result = await applyLegacyBaselineAdoption({
			manifest: bound,
			providedFingerprint: options.manifestFingerprint,
		});
		present(
			{
				status: 'APPLIED',
				manifestPath,
				manifestFingerprint: bound.manifestFingerprint,
				recoverySnapshot: snapshotPath,
				rollback: snapshot.rollback,
				entries: result.appliedEntries,
				writes: result.writes,
			},
			options.json,
		);
		return;
	}
	if (!options.dryRun) {
		throw new Error('Specify --dry-run to inspect an existing manifest.');
	}
	const refreshed = await inspect();
	const result = dryRunLegacyBaselineAdoption({ manifest: bound, refreshed });
	present(
		{
			status: 'DRY_RUN',
			manifestPath,
			manifestFingerprint: bound.manifestFingerprint,
			entries: result,
			writes: 0,
			recoveryNote:
				'Apply captures a bounded pre-write provenance snapshot (not a full critical backup) before the owner gate.',
		},
		options.json,
	);
}

if (process.argv[1]?.endsWith('legacy-baseline-adoption-cli.ts')) {
	main().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Legacy adoption command failed.';
		console.error(message);
		process.exitCode = 1;
	});
}
