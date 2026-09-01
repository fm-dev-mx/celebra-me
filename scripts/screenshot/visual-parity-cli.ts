#!/usr/bin/env tsx
/**
 * Registry-driven visual parity operations.
 *
 * Candidate captures are ignored. Accepted baselines are explicit, hash
 * recorded artifacts and are never changed by CI or compare operations.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { listLocalRenderCorpus } from '../provision/local-render-corpus/registry.ts';

const ROOT = process.cwd();
const SPECS = [
	'tests/e2e/structural-variant-portability.spec.ts',
	'tests/e2e/canonical-invitation-page-parity.spec.ts',
] as const;
const EXPECTED_VARIANT_CAPTURES = 98;
const EXPECTED_PAGE_CAPTURES = 60;
const EXPECTED_CAPTURE_COUNT = EXPECTED_VARIANT_CAPTURES + EXPECTED_PAGE_CAPTURES;
const CANDIDATE_ROOT = resolve(ROOT, '.tmp/visual-parity/candidate');
const COMPARE_ROOT = resolve(ROOT, '.tmp/visual-parity/compare');
const ACCEPTED_ROOT = resolve(ROOT, 'tests/e2e/visual-baselines');
const PLAYWRIGHT_CLI = resolve(ROOT, 'node_modules/@playwright/test/cli.js');
const ACCEPTED_MANIFEST = join(ACCEPTED_ROOT, 'manifest.json');

interface CaptureManifest {
	status: string;
	mode?: string;
	totalCaptures: number;
	runtimeFingerprint?: Record<string, unknown>;
	captures: Array<{
		file: string;
		sha256: string;
		contentHash?: string;
		assetHash?: string;
		viewport: string;
		preset: string;
		section: string;
		variant: string;
	}>;
	[key: string]: unknown;
}

interface CombinedManifest extends CaptureManifest {
	variantManifest: CaptureManifest;
	pageManifest: CaptureManifest;
}
function currentHead(): string {
	return execFileSync('git', ['rev-parse', 'HEAD'], {
		cwd: ROOT,
		encoding: 'utf8',
	}).trim();
}

function assertCleanGitState(operation: 'candidate' | 'accept'): string {
	const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
		cwd: ROOT,
		encoding: 'utf8',
	}).trim();
	if (status) {
		throw new Error(
			`Visual parity ${operation} requires a clean index and working tree. Commit or restore the current changes first.`,
		);
	}
	return currentHead();
}

function stampCandidateReference(referenceSha: string): void {
	for (const manifestPath of [
		join(CANDIDATE_ROOT, 'manifest.json'),
		join(CANDIDATE_ROOT, 'pages-manifest.json'),
	]) {
		if (!existsSync(manifestPath)) {
			throw new Error(`Missing visual manifest: ${relative(ROOT, manifestPath)}`);
		}
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CaptureManifest;
		writeFileSync(
			manifestPath,
			`${JSON.stringify({ ...manifest, referenceSha }, null, 2)}\n`,
			'utf8',
		);
	}
}

function runPlaywright(mode: 'candidate' | 'compare'): void {
	const outputRoot = mode === 'candidate' ? CANDIDATE_ROOT : COMPARE_ROOT;
	const result = spawnSync(
		process.execPath,
		[PLAYWRIGHT_CLI, 'test', ...SPECS, ...(mode === 'candidate' ? ['--update-snapshots'] : [])],
		{
			cwd: ROOT,
			stdio: 'inherit',
			env: {
				...process.env,
				VISUAL_PARITY_MODE: mode,
				VISUAL_PARITY_OUTPUT_ROOT: relative(ROOT, outputRoot).replace(/\\/g, '/'),
				VISUAL_PARITY_SNAPSHOT_ROOT:
					mode === 'candidate'
						? relative(ROOT, CANDIDATE_ROOT).replace(/\\/g, '/')
						: relative(ROOT, ACCEPTED_ROOT).replace(/\\/g, '/'),
			},
			shell: false,
		},
	);
	if (result.status !== 0) {
		throw new Error(`Visual ${mode} operation failed (exit ${result.status ?? 'null'}).`);
	}
}

function readManifest(root: string): CombinedManifest {
	const variantFile = join(root, 'manifest.json');
	const pageFile = join(root, 'pages-manifest.json');
	if (!existsSync(variantFile))
		throw new Error(`Missing visual manifest: ${relative(ROOT, variantFile)}`);
	const variantManifest = JSON.parse(readFileSync(variantFile, 'utf8')) as CaptureManifest;
	if (
		variantManifest.totalCaptures === EXPECTED_CAPTURE_COUNT &&
		Array.isArray(variantManifest.captures) &&
		variantManifest.captures.length === EXPECTED_CAPTURE_COUNT &&
		variantManifest.variantManifest &&
		variantManifest.pageManifest
	) {
		return variantManifest as CombinedManifest;
	}
	if (!existsSync(pageFile))
		throw new Error(`Missing page manifest: ${relative(ROOT, pageFile)}`);
	const pageManifest = JSON.parse(readFileSync(pageFile, 'utf8')) as CaptureManifest;
	if (
		variantManifest.totalCaptures !== EXPECTED_VARIANT_CAPTURES ||
		variantManifest.captures.length !== EXPECTED_VARIANT_CAPTURES
	) {
		throw new Error(
			`Expected ${EXPECTED_VARIANT_CAPTURES} variant captures, found ${variantManifest.totalCaptures}.`,
		);
	}
	if (
		pageManifest.totalCaptures !== EXPECTED_PAGE_CAPTURES ||
		pageManifest.captures.length !== EXPECTED_PAGE_CAPTURES
	) {
		throw new Error(
			`Expected ${EXPECTED_PAGE_CAPTURES} complete-page captures, found ${pageManifest.totalCaptures}.`,
		);
	}
	return {
		...variantManifest,
		status: variantManifest.status,
		totalCaptures: variantManifest.totalCaptures + pageManifest.totalCaptures,
		captures: [...variantManifest.captures, ...pageManifest.captures],
		variantManifest,
		pageManifest,
	};
}

function candidate(): void {
	const referenceSha = assertCleanGitState('candidate');
	const missingAssets = listLocalRenderCorpus()
		.filter((entry) => entry.assetStatus !== 'ready')
		.map((entry) => entry.slug);
	if (missingAssets.length > 0) {
		throw new Error(`VISUAL_BASELINE_ASSETS_INCOMPLETE: ${missingAssets.join(', ')}`);
	}
	runPlaywright('candidate');
	if (assertCleanGitState('candidate') !== referenceSha) {
		throw new Error('Visual parity candidate HEAD changed during capture.');
	}
	stampCandidateReference(referenceSha);

	const manifest = readManifest(CANDIDATE_ROOT);
	assertManifestIntegrity(manifest, CANDIDATE_ROOT);
	console.log(
		`Candidate ready: ${manifest.totalCaptures} captures in ${relative(ROOT, CANDIDATE_ROOT)}.`,
	);
}

function compare(): void {
	if (!existsSync(ACCEPTED_MANIFEST)) {
		throw new Error(
			`No accepted manifest at ${relative(ROOT, ACCEPTED_MANIFEST)}. Accept an approved candidate first.`,
		);
	}
	const accepted = readManifest(ACCEPTED_ROOT);
	if (accepted.status !== 'ACCEPTED')
		throw new Error('Accepted manifest is not marked ACCEPTED.');
	assertManifestIntegrity(accepted, ACCEPTED_ROOT);
	runPlaywright('compare');
	const compared = readManifest(COMPARE_ROOT);
	assertManifestIntegrity(compared, COMPARE_ROOT);
	if (
		JSON.stringify(accepted.runtimeFingerprint ?? null) !==
		JSON.stringify(compared.runtimeFingerprint ?? null)
	) {
		throw new Error('Visual runtime fingerprint drifted from the accepted baseline.');
	}
	const acceptedFiles = new Set(accepted.captures.map((capture) => capture.file));
	const comparedFiles = new Set(compared.captures.map((capture) => capture.file));
	for (const capture of compared.captures) {
		if (!acceptedFiles.has(capture.file))
			throw new Error(`Unexpected visual case: ${capture.file}`);
		const acceptedCapture = accepted.captures.find(
			(candidate) => candidate.file === capture.file,
		);
		if (
			!acceptedCapture ||
			acceptedCapture.viewport !== capture.viewport ||
			acceptedCapture.preset !== capture.preset ||
			acceptedCapture.section !== capture.section ||
			acceptedCapture.variant !== capture.variant ||
			acceptedCapture.contentHash !== capture.contentHash ||
			acceptedCapture.assetHash !== capture.assetHash
		) {
			throw new Error(`Visual manifest metadata drifted for case: ${capture.file}`);
		}
	}
	for (const capture of accepted.captures) {
		if (!comparedFiles.has(capture.file))
			throw new Error(`Missing visual case: ${capture.file}`);
	}
	console.log(`Visual parity compare passed: ${compared.totalCaptures} captures.`);
}

function listPngFiles(root: string): string[] {
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const file = join(root, entry.name);
		return entry.isDirectory() ? listPngFiles(file) : entry.name.endsWith('.png') ? [file] : [];
	});
}

function accept(referenceSha: string): void {
	if (process.env.CI) throw new Error('Baseline acceptance is unavailable in CI.');
	const head = assertCleanGitState('accept');
	if (!/^[0-9a-f]{40,64}$/i.test(referenceSha))
		throw new Error('Pass --reference-sha with a commit SHA.');
	let resolvedReferenceSha: string;
	try {
		resolvedReferenceSha = execFileSync(
			'git',
			['rev-parse', '--verify', `${referenceSha}^{commit}`],
			{ cwd: ROOT, encoding: 'utf8' },
		).trim();
	} catch {
		throw new Error(`Reference SHA does not resolve to a local commit: ${referenceSha}`);
	}
	const candidateManifest = readManifest(CANDIDATE_ROOT);
	if (resolvedReferenceSha !== head) {
		throw new Error(`Reference SHA must equal the current clean HEAD (${head}).`);
	}

	if (candidateManifest.status !== 'CANDIDATE' || candidateManifest.mode !== 'candidate') {
		throw new Error('Only a complete CANDIDATE manifest can be accepted.');
	}
	assertManifestIntegrity(candidateManifest, CANDIDATE_ROOT);
	const files = listPngFiles(CANDIDATE_ROOT);
	if (candidateManifest.referenceSha !== resolvedReferenceSha) {
		throw new Error(
			'Candidate reference SHA does not match the approved current HEAD. Regenerate the candidate.',
		);
	}

	if (files.length !== EXPECTED_CAPTURE_COUNT)
		throw new Error(
			`Expected ${EXPECTED_CAPTURE_COUNT} candidate PNGs, found ${files.length}.`,
		);
	mkdirSync(ACCEPTED_ROOT, { recursive: true });
	for (const source of files) {
		const target = join(ACCEPTED_ROOT, relative(CANDIDATE_ROOT, source));
		mkdirSync(resolve(target, '..'), { recursive: true });
		cpSync(source, target);
	}
	writeFileSync(
		ACCEPTED_MANIFEST,
		JSON.stringify(
			{
				...candidateManifest,
				status: 'ACCEPTED',
				mode: 'accepted',
				referenceSha: resolvedReferenceSha,
				acceptedFromCommit: head,
				acceptedAt: new Date().toISOString(),
			},
			null,
			2,
		) + '\n',
		'utf8',
	);
	console.log(
		`Accepted ${EXPECTED_CAPTURE_COUNT} visual baselines at ${relative(ROOT, ACCEPTED_ROOT)}.`,
	);
}

function assertManifestIntegrity(manifest: CaptureManifest, root: string): void {
	const declaredFiles = new Set(
		manifest.captures.map((capture) => capture.file.replaceAll('\\', '/')),
	);
	const actualFiles = new Set(
		listPngFiles(root).map((file) => relative(root, file).replaceAll('\\', '/')),
	);
	for (const file of actualFiles) {
		if (!declaredFiles.has(file))
			throw new Error(`Visual root contains an unlisted PNG: ${file}`);
	}
	for (const file of declaredFiles) {
		if (!actualFiles.has(file)) throw new Error(`Visual manifest is missing a PNG: ${file}`);
	}
	for (const capture of manifest.captures) {
		const absolutePath = resolve(root, capture.file);
		if (!absolutePath.startsWith(`${resolve(root)}${pathSeparator()}`)) {
			throw new Error(`Visual manifest path escapes its root: ${capture.file}`);
		}
		if (!existsSync(absolutePath)) {
			throw new Error(`Visual manifest references a missing PNG: ${capture.file}`);
		}
		const digest = createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
		if (digest !== capture.sha256) {
			throw new Error(`Visual manifest hash mismatch: ${capture.file}`);
		}
	}
}

function pathSeparator(): string {
	return process.platform === 'win32' ? '\\' : '/';
}

function main(): void {
	const [operation, ...args] = process.argv.slice(2);
	if (operation === 'candidate') return candidate();
	if (operation === 'compare') return compare();
	if (operation === 'accept') {
		const inline = args.find((arg) => arg.startsWith('--reference-sha='));
		const positional = args.findIndex((arg) => arg === '--reference-sha');
		const value =
			inline?.slice('--reference-sha='.length) ??
			(positional >= 0 ? args[positional + 1] : undefined);
		return accept(value ?? '');
	}
	throw new Error('Usage: visual-parity-cli.ts candidate|compare|accept --reference-sha=<sha>');
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
