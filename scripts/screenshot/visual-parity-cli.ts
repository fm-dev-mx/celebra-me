#!/usr/bin/env tsx
/**
 * Registry-driven visual parity operations.
 *
 * Candidate captures are ignored. Accepted baselines are explicit, hash
 * recorded artifacts and are never changed by CI or compare operations.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { listLocalRenderCorpus } from '../provision/local-render-corpus/registry.ts';
import {
	buildVisualCoverageCases,
	computeVisualMatrixHash,
	VISUAL_VIEWPORTS,
} from './visual-coverage-contract.ts';

const ROOT = process.cwd();
const SPECS = [
	'tests/e2e/structural-variant-portability.spec.ts',
	'tests/e2e/canonical-invitation-page-parity.spec.ts',
] as const;
const VISUAL_COVERAGE_CASE_VIEWPORT_COUNT = VISUAL_VIEWPORTS.length;
const VISUAL_COVERAGE = buildVisualCoverageCases();
const EXPECTED_VARIANT_CAPTURES = VISUAL_COVERAGE.variantCases.length;
const EXPECTED_PAGE_CAPTURES =
	VISUAL_COVERAGE.pageCases.length * VISUAL_COVERAGE_CASE_VIEWPORT_COUNT;
const EXPECTED_CAPTURE_COUNT = VISUAL_COVERAGE.cases.length;
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
		kind?: string;
		file: string;
		sha256: string;
		contentHash?: string;
		assetHash?: string;
		viewport: string;
		preset: string;
		section: string;
		variant: string;
	}>;
	matrixHash?: string;
	[key: string]: unknown;
}

interface CombinedManifest extends CaptureManifest {
	variantManifest: CaptureManifest;
	pageManifest: CaptureManifest;
}

const ACCEPTED_VISUAL_RUNTIME = {
	node: 'v24.14.1',
	pnpm: '11.23.0',
	playwright: '1.62.1',
	browser: 'chromium',
	platform: 'linux-x64',
	locale: 'en-US',
	timezone: 'UTC',
	deviceScaleFactor: 1,
} as const;

const HASH_KEYS = ['lockfileSha256', 'cssSha256', 'assetSha256', 'fontSha256'] as const;

function assertPinnedVisualRuntime(
	manifest: CaptureManifest,
	operation: 'compare' | 'accept',
): void {
	const runtime = manifest.runtimeFingerprint;
	if (!runtime) {
		throw new Error(`Visual ${operation} requires a runtime fingerprint.`);
	}
	for (const [key, expected] of Object.entries(ACCEPTED_VISUAL_RUNTIME)) {
		if (runtime[key] !== expected) {
			throw new Error(
				`Visual ${operation} requires pinned runtime ${key}=${String(expected)}; found ${String(runtime[key])}.`,
			);
		}
	}
	if (
		typeof runtime.osImageDigest !== 'string' ||
		!/^sha256:[0-9a-f]{64}$/iu.test(runtime.osImageDigest)
	) {
		throw new Error(
			`Visual ${operation} requires a verified Linux image digest (sha256:<64 hex characters>).`,
		);
	}
	for (const key of HASH_KEYS) {
		if (typeof runtime[key] !== 'string' || !/^[0-9a-f]{64}$/iu.test(runtime[key])) {
			throw new Error(
				`Visual ${operation} requires a valid ${key} in the runtime fingerprint.`,
			);
		}
	}
	if (
		typeof runtime.browserVersion !== 'string' ||
		runtime.browserVersion === 'unknown' ||
		typeof runtime.browserRevision !== 'string' ||
		runtime.browserRevision === 'unknown'
	) {
		throw new Error(`Visual ${operation} requires a resolved Chromium version and revision.`);
	}
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
	const combinedFile = join(root, 'combined-manifest.json');
	if (!existsSync(variantFile) && !existsSync(combinedFile)) {
		throw new Error(`Missing visual manifest: ${relative(ROOT, variantFile)}`);
	}
	const raw = JSON.parse(
		readFileSync(existsSync(combinedFile) ? combinedFile : variantFile, 'utf8'),
	) as CaptureManifest & Partial<CombinedManifest>;
	const variantManifest = raw.variantManifest ?? raw;
	if (!variantManifest || !Array.isArray(variantManifest.captures)) {
		throw new Error('Visual manifest must declare a captures array. Regenerate the candidate.');
	}
	let pageManifest = raw.pageManifest;
	if (!pageManifest && existsSync(pageFile)) {
		pageManifest = JSON.parse(readFileSync(pageFile, 'utf8')) as CaptureManifest;
	}
	if (!pageManifest) {
		if (!Array.isArray(raw.captures)) {
			throw new Error(
				`Missing page manifest: ${relative(ROOT, pageFile)}. Regenerate the candidate.`,
			);
		}
		const pageCaptures = raw.captures.filter((capture) => capture.kind === 'page');
		pageManifest = { ...raw, captures: pageCaptures, totalCaptures: pageCaptures.length };
	}
	if (!Array.isArray(pageManifest.captures)) {
		throw new Error('Page manifest must declare a captures array. Regenerate the candidate.');
	}
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
	const captures = [...variantManifest.captures, ...pageManifest.captures];
	return {
		...variantManifest,
		totalCaptures: captures.length,
		captures,
		matrixHash: computeVisualMatrixHash(captures as unknown as Array<Record<string, unknown>>),
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
	assertCoverageMatrix(manifest);
	writeCombinedCandidateArtifacts(CANDIDATE_ROOT, manifest);
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
	assertPinnedVisualRuntime(accepted, 'compare');
	runPlaywright('compare');
	const compared = readManifest(COMPARE_ROOT);
	assertManifestIntegrity(compared, COMPARE_ROOT);
	assertPinnedVisualRuntime(compared, 'compare');
	assertCoverageMatrix(accepted);
	if (
		JSON.stringify(accepted.runtimeFingerprint ?? null) !==
		JSON.stringify(compared.runtimeFingerprint ?? null)
	) {
		throw new Error('Visual runtime fingerprint drifted from the accepted baseline.');
	}
	if (!accepted.matrixHash || compared.matrixHash !== accepted.matrixHash) {
		throw new Error('Visual coverage matrix drifted from the accepted baseline.');
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

function assertCoverageMatrix(manifest: CombinedManifest): void {
	const expectedHash = computeVisualMatrixHash(VISUAL_COVERAGE.cases);
	const actualHash = computeVisualMatrixHash(
		manifest.captures as unknown as Array<Record<string, unknown>>,
	);
	if (manifest.matrixHash !== actualHash || actualHash !== expectedHash) {
		throw new Error(
			`Visual coverage matrix drifted: expected ${expectedHash}, found ${manifest.matrixHash ?? actualHash}.`,
		);
	}
}
function writeCombinedCandidateArtifacts(root: string, manifest: CombinedManifest): void {
	const combinedPath = join(root, 'combined-manifest.json');
	const payload = {
		...manifest,
		status: 'CANDIDATE',
		mode: 'candidate',
		matrixHash: computeVisualMatrixHash(
			manifest.captures as unknown as Array<Record<string, unknown>>,
		),
	};
	const candidateManifestSha256 = createHash('sha256')
		.update(JSON.stringify(payload))
		.digest('hex');
	writeFileSync(
		combinedPath,
		`${JSON.stringify({ ...payload, candidateManifestSha256 }, null, 2)}\n`,
		'utf8',
	);
	const cards = manifest.captures
		.map(
			(capture) => `
    <article><header><strong>${capture.section || capture.kind || 'page'}${capture.variant ? `.${capture.variant}` : ''}</strong>
    <span>${capture.preset ?? ''} / ${capture.viewport}</span></header>
    <a href="${capture.file}"><img src="${capture.file}" alt="${capture.file}" loading="lazy"></a>
    <code>${capture.sha256}</code></article>`,
		)
		.join('');
	writeFileSync(
		join(root, 'combined-contact-sheet.html'),
		`<!doctype html><html lang="es"><meta charset="utf-8"><title>Visual parity candidate</title>
    <style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;margin:2rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:1rem}article{background:#1e293b;padding:1rem;border-radius:8px}header{display:flex;justify-content:space-between;gap:.5rem;margin-bottom:.5rem}img{max-width:100%;height:auto;border:1px solid #475569}code{display:block;word-break:break-all;font-size:.7rem;color:#cbd5e1;margin-top:.5rem}</style>
    <p>Candidate: ${manifest.totalCaptures} cases · matrix ${manifest.matrixHash ?? 'uncomputed'} · manifest ${candidateManifestSha256}</p><main>${cards}</main></html>`,
		'utf8',
	);
}
function listPngFiles(root: string): string[] {
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const file = join(root, entry.name);
		return entry.isDirectory() ? listPngFiles(file) : entry.name.endsWith('.png') ? [file] : [];
	});
}

function accept(
	referenceSha: string,
	approvedMatrixHash: string,
	approvedCandidateManifestSha256: string,
): void {
	if (process.env.CI) throw new Error('Baseline acceptance is unavailable in CI.');
	if (!approvedMatrixHash || !approvedCandidateManifestSha256) {
		throw new Error(
			'Baseline acceptance requires --matrix-hash and --candidate-manifest-sha256 from the reviewed candidate.',
		);
	}
	const head = assertCleanGitState('accept');
	const resolvedReferenceSha = resolveReferenceSha(referenceSha, head);
	const candidateManifest = readManifest(CANDIDATE_ROOT);
	assertCandidateManifest(candidateManifest, resolvedReferenceSha);
	assertManifestIntegrity(candidateManifest, CANDIDATE_ROOT);
	assertPinnedVisualRuntime(candidateManifest, 'accept');
	assertCoverageMatrix(candidateManifest);
	const { candidateManifestSha256, files } = validateCandidateArtifacts();
	if (candidateManifest.matrixHash !== approvedMatrixHash) {
		throw new Error('Approved matrix hash does not match the candidate manifest.');
	}
	if (candidateManifestSha256 !== approvedCandidateManifestSha256) {
		throw new Error('Approved candidate manifest hash does not match the candidate artifact.');
	}

	const stagingRoot = resolve(ROOT, '.tmp/visual-parity/accepted-' + process.pid);
	stageCandidateFiles(stagingRoot, files);
	const acceptedPayload = {
		...candidateManifest,
		status: 'ACCEPTED',
		mode: 'accepted',
		referenceSha: resolvedReferenceSha,
		acceptedFromCommit: head,
		acceptedAt: new Date().toISOString(),
		candidateManifestSha256,
	};
	writeFileSync(
		join(stagingRoot, 'manifest.json'),
		JSON.stringify(acceptedPayload, null, 2) + '\n',
		'utf8',
	);
	assertManifestIntegrity(acceptedPayload, stagingRoot);

	const backupRoot = resolve(ROOT, '.tmp/visual-parity/accepted-backup-' + head.slice(0, 12));
	replaceAcceptedRoot(stagingRoot, backupRoot);
	console.log(
		'Accepted ' +
			EXPECTED_CAPTURE_COUNT +
			' visual baselines at ' +
			relative(ROOT, ACCEPTED_ROOT) +
			'.',
	);
}

function resolveReferenceSha(referenceSha: string, head: string): string {
	if (!/^[0-9a-f]{40,64}$/i.test(referenceSha))
		throw new Error('Pass --reference-sha with a commit SHA.');
	let resolved: string;
	try {
		resolved = execFileSync('git', ['rev-parse', '--verify', referenceSha + '^{commit}'], {
			cwd: ROOT,
			encoding: 'utf8',
		}).trim();
	} catch {
		throw new Error('Reference SHA does not resolve to a local commit: ' + referenceSha);
	}
	if (resolved !== head)
		throw new Error('Reference SHA must equal the current clean HEAD (' + head + ').');
	return resolved;
}

function assertCandidateManifest(manifest: CombinedManifest, referenceSha: string): void {
	if (manifest.status !== 'CANDIDATE' || manifest.mode !== 'candidate') {
		throw new Error('Only a complete CANDIDATE manifest can be accepted.');
	}
	if (manifest.referenceSha !== referenceSha) {
		throw new Error(
			'Candidate reference SHA does not match the approved current HEAD. Regenerate the candidate.',
		);
	}
}

function validateCandidateArtifacts(): { candidateManifestSha256: string; files: string[] } {
	const combinedManifestPath = join(CANDIDATE_ROOT, 'combined-manifest.json');
	if (!existsSync(combinedManifestPath))
		throw new Error('Combined candidate manifest is missing.');
	const combinedManifest = JSON.parse(readFileSync(combinedManifestPath, 'utf8')) as Record<
		string,
		unknown
	>;
	const candidateManifestSha256 = combinedManifest.candidateManifestSha256;
	const combinedPayload = { ...combinedManifest };
	delete combinedPayload.candidateManifestSha256;
	if (
		typeof candidateManifestSha256 !== 'string' ||
		createHash('sha256').update(JSON.stringify(combinedPayload)).digest('hex') !==
			candidateManifestSha256
	) {
		throw new Error('Combined candidate manifest hash is invalid. Regenerate the candidate.');
	}
	const files = listPngFiles(CANDIDATE_ROOT);
	if (files.length !== EXPECTED_CAPTURE_COUNT) {
		throw new Error(
			'Expected ' + EXPECTED_CAPTURE_COUNT + ' candidate PNGs, found ' + files.length + '.',
		);
	}
	return { candidateManifestSha256, files };
}

function stageCandidateFiles(stagingRoot: string, files: readonly string[]): void {
	if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });
	mkdirSync(stagingRoot, { recursive: true });
	for (const source of files) {
		const target = join(stagingRoot, relative(CANDIDATE_ROOT, source));
		mkdirSync(resolve(target, '..'), { recursive: true });
		cpSync(source, target);
	}
}

function replaceAcceptedRoot(stagingRoot: string, backupRoot: string): void {
	if (existsSync(backupRoot)) rmSync(backupRoot, { recursive: true, force: true });
	try {
		if (existsSync(ACCEPTED_ROOT)) renameSync(ACCEPTED_ROOT, backupRoot);
		renameSync(stagingRoot, ACCEPTED_ROOT);
		if (existsSync(backupRoot)) rmSync(backupRoot, { recursive: true, force: true });
	} catch (error) {
		if (!existsSync(ACCEPTED_ROOT) && existsSync(backupRoot))
			renameSync(backupRoot, ACCEPTED_ROOT);
		if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });
		throw error;
	}
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
		if (!absolutePath.startsWith(`${resolve(root)}${sep}`)) {
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

function main(): void {
	const [operation, ...args] = process.argv.slice(2);
	if (operation === 'candidate') return candidate();
	if (operation === 'compare') return compare();
	if (operation === 'accept') {
		const inline = args.find((arg) => arg.startsWith('--reference-sha='));
		const positional = args.findIndex((arg) => arg === '--reference-sha');
		const referenceSha =
			inline?.slice('--reference-sha='.length) ??
			(positional >= 0 ? args[positional + 1] : undefined);
		const matrixInline = args.find((arg) => arg.startsWith('--matrix-hash='));
		const matrixPositional = args.findIndex((arg) => arg === '--matrix-hash');
		const matrixHash =
			matrixInline?.slice('--matrix-hash='.length) ??
			(matrixPositional >= 0 ? args[matrixPositional + 1] : undefined);
		const manifestInline = args.find((arg) => arg.startsWith('--candidate-manifest-sha256='));
		const manifestPositional = args.findIndex((arg) => arg === '--candidate-manifest-sha256');
		const candidateManifestSha256 =
			manifestInline?.slice('--candidate-manifest-sha256='.length) ??
			(manifestPositional >= 0 ? args[manifestPositional + 1] : undefined);
		return accept(referenceSha ?? '', matrixHash ?? '', candidateManifestSha256 ?? '');
	}
	throw new Error(
		'Usage: visual-parity-cli.ts candidate|compare|accept --reference-sha=<sha> --matrix-hash=<hash> --candidate-manifest-sha256=<hash>',
	);
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
