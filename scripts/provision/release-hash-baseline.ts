/**
 * release-hash-baseline.ts — Detects changes that move the packageHash of active invitations.
 *
 * A Preview approval binds to an exact packageHash. A global refactor (serializer, section
 * mapper, share-message builder, asset delivery) can move the hash of every invitation and
 * silently invalidate their approvals; `prod:apply` then reports them as MISSING_PREVIEW_APPROVAL.
 * This guard compares the current hashes with a committed baseline and separates expected moves
 * (the invitation's own definition or assets changed) from collateral ones.
 *
 * Usage:
 *   pnpm invitation:hash-baseline                      # report (read-only, no network, no DB)
 *   pnpm invitation:hash-baseline -- --files a.ts,b.ts # classify against changed files
 *   pnpm invitation:hash-baseline -- --strict          # exit 1 on collateral moves
 *   pnpm invitation:hash-baseline -- --update          # rewrite the baseline after a release
 *
 * validate:changed runs the report (advisory) whenever provisioning or serializer paths change;
 * the trigger list lives in scripts/validation-runner.mjs.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
	getInvitationAssetSourceDir,
	type InvitationDefinition,
} from './invitations/invitation-definition.ts';

export const RELEASE_HASH_BASELINE_PATH = 'scripts/provision/release-hash-baseline.json';
export const RELEASE_HASH_UPDATE_COMMAND = 'pnpm invitation:hash-baseline -- --update';

export interface ReleaseHashBaseline {
	/** slug → packageHash of every active (non-archived) invitation definition. */
	packageHashes: Record<string, string>;
}

export interface ReleaseHashMove {
	slug: string;
	previous: string;
	current: string;
}

export interface ReleaseHashReport {
	/** Hash moved although none of the invitation's own files changed (global refactor). */
	collateral: ReleaseHashMove[];
	/** Hash moved together with the invitation's own definition or assets. */
	expected: ReleaseHashMove[];
	added: string[];
	removed: string[];
}

function normalize(file: string): string {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

/** Files that belong to one invitation: its definition module and its asset directory. */
export function ownsChangedFile(
	definition: Pick<InvitationDefinition, 'slug' | 'assetDir'>,
	changedFiles: readonly string[],
): boolean {
	const definitionFile = `scripts/provision/invitations/${definition.slug}.ts`;
	const assetDir = `${normalize(getInvitationAssetSourceDir(definition as InvitationDefinition))}/`;
	return changedFiles
		.map(normalize)
		.some((file) => file === definitionFile || file.startsWith(assetDir));
}

export function diffReleaseHashes(input: {
	baseline: ReleaseHashBaseline;
	current: Record<string, string>;
	definitions: ReadonlyArray<Pick<InvitationDefinition, 'slug' | 'assetDir'>>;
	changedFiles: readonly string[];
}): ReleaseHashReport {
	const report: ReleaseHashReport = { collateral: [], expected: [], added: [], removed: [] };
	const bySlug = new Map(input.definitions.map((definition) => [definition.slug, definition]));
	for (const [slug, current] of Object.entries(input.current).sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		const previous = input.baseline.packageHashes[slug];
		if (previous === undefined) {
			report.added.push(slug);
			continue;
		}
		if (previous === current) continue;
		const definition = bySlug.get(slug);
		const move = { slug, previous, current };
		if (definition && ownsChangedFile(definition, input.changedFiles)) {
			report.expected.push(move);
		} else {
			report.collateral.push(move);
		}
	}
	report.removed = Object.keys(input.baseline.packageHashes)
		.filter((slug) => !(slug in input.current))
		.sort((a, b) => a.localeCompare(b));
	return report;
}

export function formatReleaseHashReport(report: ReleaseHashReport): string {
	const short = (hash: string) => `${hash.slice(0, 12)}…`;
	const lines: string[] = [];
	if (report.collateral.length > 0) {
		lines.push(
			`⚠ ${report.collateral.length} invitación(es) activa(s) cambian de packageHash sin cambios propios:`,
		);
		for (const move of report.collateral) {
			lines.push(`  - ${move.slug}: ${short(move.previous)} → ${short(move.current)}`);
		}
		lines.push(
			'  Toda aprobación Preview de esos hashes deja de valer y prod:apply las mostrará como MISSING_PREVIEW_APPROVAL.',
			'  Si el cambio es intencional: vuelva a liberarlas en Preview (pnpm invitation:release -- --slug <slug> --targets preview)',
			`  y actualice la línea base con ${RELEASE_HASH_UPDATE_COMMAND}. Si no, evite que el refactor altere el contenido publicado.`,
		);
	}
	if (report.expected.length > 0) {
		lines.push(
			`ℹ ${report.expected.length} invitación(es) cambian de packageHash junto con su propia definición o assets: ${report.expected
				.map((move) => move.slug)
				.join(', ')}. Requieren release Preview antes de Production.`,
		);
	}
	if (report.added.length > 0) {
		lines.push(
			`ℹ Sin línea base: ${report.added.join(', ')} (${RELEASE_HASH_UPDATE_COMMAND}).`,
		);
	}
	if (report.removed.length > 0) {
		lines.push(
			`ℹ Fuera de la línea base (archivadas o eliminadas): ${report.removed.join(', ')}.`,
		);
	}
	if (lines.length === 0) lines.push('✓ packageHash de invitaciones activas sin cambios.');
	return lines.join('\n');
}

export function readReleaseHashBaseline(path = RELEASE_HASH_BASELINE_PATH): ReleaseHashBaseline {
	if (!existsSync(path)) return { packageHashes: {} };
	return JSON.parse(readFileSync(path, 'utf8')) as ReleaseHashBaseline;
}

/** Builds every active package locally (no DB, no network) and returns slug → packageHash. */
export async function computeActivePackageHashes(): Promise<{
	hashes: Record<string, string>;
	definitions: InvitationDefinition[];
}> {
	const [{ listActiveInvitationDefinitions }, { resolveInvitationPackageInput }] =
		await Promise.all([
			import('./invitations/registry.ts'),
			import('./invitation-package-input.ts'),
		]);
	const definitions = listActiveInvitationDefinitions();
	const hashes: Record<string, string> = {};
	for (const definition of definitions) {
		const resolved = await resolveInvitationPackageInput({ slug: definition.slug });
		hashes[definition.slug] = resolved.packageData.packageHash;
	}
	return { hashes, definitions };
}

function parseFilesArg(argv: readonly string[]): string[] {
	const index = argv.indexOf('--files');
	if (index === -1) return [];
	return (argv[index + 1] ?? '').split(',').filter(Boolean);
}

export async function runReleaseHashBaselineCli(argv = process.argv.slice(2)): Promise<number> {
	const { hashes, definitions } = await computeActivePackageHashes();
	if (argv.includes('--update')) {
		const sorted = Object.fromEntries(
			Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)),
		);
		writeFileSync(
			RELEASE_HASH_BASELINE_PATH,
			`${JSON.stringify({ packageHashes: sorted }, null, 4)}\n`,
		);
		console.log(
			`✓ Línea base actualizada (${Object.keys(sorted).length} invitaciones activas).`,
		);
		return 0;
	}
	const report = diffReleaseHashes({
		baseline: readReleaseHashBaseline(),
		current: hashes,
		definitions,
		changedFiles: parseFilesArg(argv),
	});
	console.log(formatReleaseHashReport(report));
	return argv.includes('--strict') && report.collateral.length > 0 ? 1 : 0;
}

function isMain(): boolean {
	const entry = process.argv[1];
	return typeof entry === 'string' && /release-hash-baseline\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isMain()) {
	runReleaseHashBaselineCli().then(
		(code) => process.exit(code),
		(error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		},
	);
}
