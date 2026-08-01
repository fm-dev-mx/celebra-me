/** CLI boundary for the read-only legacy baseline adoption preparation flow. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { exportInvitationPackage } from './invitation-package.ts';
import {
	assertLegacyBaselineApplyBlocked,
	createLegacyBaselineAdoptionManifest,
	dryRunLegacyBaselineAdoption,
	LEGACY_BASELINE_ADOPTION_SLUGS,
	readLegacyAdoptionCandidate,
	type LegacyBaselineAdoptionManifest,
} from './legacy-baseline-adoption.ts';

interface CliOptions {
	manifestPath?: string;
	outPath?: string;
	dryRun: boolean;
	apply: boolean;
	manifestFingerprint?: string;
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
		futureApply: `pnpm invitation:legacy-baseline-adoption -- --manifest ${quoted} --manifest-fingerprint ${fingerprint} --apply --json`,
	};
}

function writeManifest(path: string, manifest: LegacyBaselineAdoptionManifest): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
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
		assertLegacyBaselineApplyBlocked({
			manifest: bound,
			providedFingerprint: options.manifestFingerprint,
		});
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
