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
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { assertManifestIntegrity, listPngFiles } from './visual-manifest-integrity.ts';
import {
	readVisualManifest,
	type CaptureManifest,
	type CombinedManifest,
} from './visual-manifest.ts';
import { listLocalRenderCorpus } from '../provision/local-render-corpus/registry.ts';
import { VISUAL_PARITY_RUNTIME } from '../../tests/e2e/harness/visual-parity-metadata.ts';
import { assertVisualRuntimeReady } from '../../tests/e2e/harness/visual-baseline-policy.ts';
import {
	buildVisualCoverageCases,
	computeVisualMatrixHash,
	VISUAL_VIEWPORTS,
} from './visual-coverage-contract.ts';
import { expectedVisualCaptures } from './visual-record-aggregator.ts';
import { buildCandidateReview, writeCandidateReview } from './visual-candidate-review.ts';
import { readVisualRecordObservations } from '../../tests/e2e/harness/visual-capture-record.ts';

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
let failurePhase = 'PREFLIGHT';

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

function assertCaptureEnvironment(operation: 'compare' | 'candidate'): void {
	if (
		process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES !== 'true' ||
		process.env.PLAYWRIGHT_REQUIRE_VISUAL_PREFLIGHT !== 'true' ||
		process.env.PLAYWRIGHT_BASE_URL ||
		process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true'
	) {
		throw new Error(
			'Certified captures require isolated canonical fixtures and visual preflight.',
		);
	}
	assertPinnedVisualRuntime({ runtimeFingerprint: VISUAL_PARITY_RUNTIME }, operation);
	console.log(
		`Visual capture: SHA=${currentHead()} mode=${operation} image=${VISUAL_PARITY_RUNTIME.osImageDigest}`,
	);
}

export function assertPinnedVisualRuntime(
	manifest: Pick<CaptureManifest, 'runtimeFingerprint'>,
	operation: 'compare' | 'accept' | 'candidate',
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
	const relevantChanges = status
		.split(/\r?\n/)
		.filter((line) => line && !line.includes('scripts/screenshot/visual-parity-cli.ts'));
	if (relevantChanges.length > 0) {
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
	failurePhase = 'BROWSER';
	const outputRoot = mode === 'candidate' ? CANDIDATE_ROOT : COMPARE_ROOT;
	const result = spawnSync(
		process.execPath,
		[
			PLAYWRIGHT_CLI,
			'test',
			...SPECS,
			// Seeded accepted bytes are rewritten only when the fresh capture fails the gate.
			...(mode === 'candidate' ? ['--update-snapshots=changed'] : []),
		],
		{
			cwd: ROOT,
			stdio: 'inherit',
			env: {
				...process.env,
				VISUAL_PARITY_MODE: mode,
				PLAYWRIGHT_REQUIRE_VISUAL_PREFLIGHT: 'true',
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

function readManifest(root: string, preferSuiteManifests = false): CombinedManifest {
	return readVisualManifest(
		root,
		{
			variants: EXPECTED_VARIANT_CAPTURES,
			pages: EXPECTED_PAGE_CAPTURES,
		},
		preferSuiteManifests,
	);
}

function candidate(expectedSha?: string): void {
	const referenceSha = assertCleanGitState('candidate');
	if (expectedSha && expectedSha !== referenceSha) {
		throw new Error(
			`Candidate SHA mismatch: requested ${expectedSha}, current HEAD is ${referenceSha}.`,
		);
	}
	assertCaptureEnvironment('candidate');
	failurePhase = 'MANIFEST';
	const previous = readPreviousAccepted();
	const missingAssets = listLocalRenderCorpus()
		.filter((entry) => entry.assetStatus !== 'ready')
		.map((entry) => entry.slug);
	if (missingAssets.length > 0) {
		throw new Error(`VISUAL_BASELINE_ASSETS_INCOMPLETE: ${missingAssets.join(', ')}`);
	}
	// Preserve the complete prior review bundle before any capture can replace its files.
	const archived = archiveCandidate(CANDIDATE_ROOT);
	if (archived) console.log(`Previous candidate preserved: ${relative(ROOT, archived)}`);
	const seeded = seedCandidateWithAccepted(previous, CANDIDATE_ROOT);
	console.log(
		seeded === null
			? 'Candidate starts empty: the accepted runtime differs from the capture runtime.'
			: `Candidate seeded with ${seeded} accepted references; only gate failures are rewritten.`,
	);
	runPlaywright('candidate');
	if (assertCleanGitState('candidate') !== referenceSha) {
		throw new Error('Visual parity candidate HEAD changed during capture.');
	}
	failurePhase = 'MANIFEST';
	stampCandidateReference(referenceSha);

	const manifest = readManifest(CANDIDATE_ROOT, true);
	assertPinnedVisualRuntime(manifest, 'candidate');
	assertManifestIntegrity(manifest, CANDIDATE_ROOT);
	failurePhase = 'COVERAGE';
	assertCoverageMatrix(manifest);
	failurePhase = 'REPORT';
	writeCombinedCandidateArtifacts(CANDIDATE_ROOT, manifest);
	console.log(
		`Candidate ready: ${manifest.totalCaptures} captures in ${relative(ROOT, CANDIDATE_ROOT)}.`,
	);
}

function compare(): void {
	assertCaptureEnvironment('compare');
	failurePhase = 'MANIFEST';
	if (!existsSync(ACCEPTED_MANIFEST)) {
		throw new Error(
			`No accepted manifest at ${relative(ROOT, ACCEPTED_MANIFEST)}. Accept an approved candidate first.`,
		);
	}
	const coverageManifest = JSON.parse(readFileSync(ACCEPTED_MANIFEST, 'utf8')) as CaptureManifest;
	failurePhase = 'COVERAGE';
	assertCoverageMatrix(coverageManifest);
	failurePhase = 'MANIFEST';
	const accepted = readManifest(ACCEPTED_ROOT);
	if (accepted.status !== 'ACCEPTED')
		throw new Error('Accepted manifest is not marked ACCEPTED.');
	assertManifestIntegrity(accepted, ACCEPTED_ROOT);
	assertPinnedVisualRuntime(accepted, 'compare');
	assertVisualRuntimeReady(accepted.runtimeFingerprint ?? {}, VISUAL_PARITY_RUNTIME);
	assertCoverageMatrix(accepted);
	runPlaywright('compare');
	failurePhase = 'MANIFEST';
	const compared = readManifest(COMPARE_ROOT, true);
	assertManifestIntegrity(compared, COMPARE_ROOT);
	assertPinnedVisualRuntime(compared, 'compare');
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

export function assertCoverageMatrix(
	manifest: Pick<CaptureManifest, 'captures' | 'matrixHash'>,
): void {
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
export function readPreviousAccepted(root = ACCEPTED_ROOT): CaptureManifest | null {
	const manifestPath = join(root, 'manifest.json');
	if (!existsSync(manifestPath)) return null;
	// The previous matrix may legitimately have fewer cases than the new candidate.
	const previous = JSON.parse(readFileSync(manifestPath, 'utf8')) as CaptureManifest;
	if (previous.status !== 'ACCEPTED' || !Array.isArray(previous.captures))
		throw new Error('Previous visual references are invalid.');
	assertManifestIntegrity(previous, root);
	return previous;
}

/** Review bundle directories that sit beside the candidate root. */
export const CANDIDATE_SIBLINGS = ['candidate-references', 'candidate-diffs'] as const;

export function archiveCandidate(root: string): string | undefined {
	const siblings = CANDIDATE_SIBLINGS.map((name) => [name, join(root, '..', name)] as const);
	if (!existsSync(root) && siblings.every(([, sibling]) => !existsSync(sibling)))
		return undefined;
	const history = resolve(root, '..', 'history');
	mkdirSync(history, { recursive: true });
	const attempt = mkdtempSync(join(history, 'candidate-'));
	if (existsSync(root)) renameSync(root, join(attempt, 'candidate'));
	for (const [name, sibling] of siblings) {
		if (existsSync(sibling)) renameSync(sibling, join(attempt, name));
	}
	return attempt;
}

/** Runtime identity that must match before accepted bytes can stand in for fresh captures. */
const SEED_RUNTIME_KEYS = [
	'node',
	'pnpm',
	'playwright',
	'browser',
	'browserRevision',
	'browserVersion',
	'platform',
	'locale',
	'timezone',
	'deviceScaleFactor',
	'osImageDigest',
	'fontSha256',
] as const;

export function canSeedCandidateFromAccepted(
	accepted: Record<string, unknown> | undefined,
	current: Readonly<Record<string, unknown>>,
): boolean {
	return Boolean(accepted) && SEED_RUNTIME_KEYS.every((key) => accepted?.[key] === current[key]);
}

/**
 * Copies accepted references for every case of the current matrix into the empty candidate
 * root. Playwright's `changed` update mode keeps them when the fresh capture passes the gate, so
 * render noise no longer becomes a review item or new LFS bytes. Real copies are required: a
 * link would let the update write into the accepted directory.
 */
export function seedCandidateWithAccepted(
	previous: CaptureManifest | null,
	candidateRoot: string,
	acceptedRoot = ACCEPTED_ROOT,
	runtime: Readonly<Record<string, unknown>> = VISUAL_PARITY_RUNTIME,
	expectedFiles: readonly string[] = (['variants', 'pages'] as const).flatMap((suite) =>
		expectedVisualCaptures(suite).map((entry) => entry.file),
	),
): number | null {
	if (!previous || !canSeedCandidateFromAccepted(previous.runtimeFingerprint, runtime))
		return null;
	const accepted = new Set(previous.captures.map((capture) => capture.file));
	let seeded = 0;
	for (const file of expectedFiles) {
		if (!accepted.has(file)) continue;
		const target = join(candidateRoot, file);
		mkdirSync(dirname(target), { recursive: true });
		copyFileSync(join(acceptedRoot, file), target);
		seeded++;
	}
	return seeded;
}

export function writeCombinedCandidateArtifacts(
	root: string,
	manifest: CombinedManifest,
	previous: CaptureManifest | null = readPreviousAccepted(),
	acceptedRoot = ACCEPTED_ROOT,
): void {
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
	writeCandidateReview(
		root,
		buildCandidateReview({
			root,
			captures: manifest.captures,
			previous,
			acceptedRoot,
			observedSha256: readVisualRecordObservations(root),
			matrixHash: payload.matrixHash,
			referenceSha: manifest.referenceSha,
			candidateManifestSha256,
		}),
	);
}

function accept(
	referenceSha?: string,
	approvedMatrixHash?: string,
	approvedCandidateManifestSha256?: string,
): void {
	if (process.env.CI) throw new Error('Baseline acceptance is unavailable in CI.');
	const head = assertCleanGitState('accept');
	const resolvedReferenceSha = referenceSha ? resolveReferenceSha(referenceSha, head) : head;
	const candidateManifest = readManifest(CANDIDATE_ROOT);
	assertCandidateManifest(candidateManifest, resolvedReferenceSha);
	assertManifestIntegrity(candidateManifest, CANDIDATE_ROOT);
	assertPinnedVisualRuntime(candidateManifest, 'accept');
	assertCoverageMatrix(candidateManifest);
	const { candidateManifestSha256, files } = validateCandidateArtifacts();

	if (approvedMatrixHash && candidateManifest.matrixHash !== approvedMatrixHash) {
		throw new Error('Approved matrix hash does not match the candidate manifest.');
	}
	if (
		approvedCandidateManifestSha256 &&
		candidateManifestSha256 !== approvedCandidateManifestSha256
	) {
		throw new Error('Approved candidate manifest hash does not match the candidate artifact.');
	}

	const stagingRoot = resolve(ROOT, '.tmp/visual-parity/accepted-' + process.pid);
	stageCandidateFiles(stagingRoot, files);
	const acceptedPayload = {
		...candidateManifest,
		status: 'ACCEPTED',
		mode: 'accepted',
		captures: candidateManifest.captures.map((capture) => ({
			...capture,
			comparisonResult: 'ACCEPTED',
		})),
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
		return;
	} catch {
		try {
			mkdirSync(ACCEPTED_ROOT, { recursive: true });
			const stagedFiles = new Set(readdirSync(stagingRoot));
			for (const file of readdirSync(ACCEPTED_ROOT)) {
				if (!stagedFiles.has(file)) {
					rmSync(join(ACCEPTED_ROOT, file), { recursive: true, force: true });
				}
			}
			cpSync(stagingRoot, ACCEPTED_ROOT, { recursive: true, force: true });
			if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });
			if (existsSync(backupRoot)) rmSync(backupRoot, { recursive: true, force: true });
			return;
		} catch (fallbackError) {
			if (!existsSync(ACCEPTED_ROOT) && existsSync(backupRoot))
				renameSync(backupRoot, ACCEPTED_ROOT);
			if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });
			throw fallbackError;
		}
	}
}

function certifiedBrowser(args: string[]): void {
	if (args.some((arg) => /^(?:-u|--update-snapshots)(?:=|$)/.test(arg))) {
		throw new Error('Certified browser comparison cannot update snapshots.');
	}
	process.env.VISUAL_PARITY_MODE = 'compare';
	process.env.VISUAL_PARITY_SNAPSHOT_ROOT = 'tests/e2e/visual-baselines';
	process.env.VISUAL_PARITY_OUTPUT_ROOT = '.tmp/visual-parity/compare';
	process.env.CI = 'true';
	process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES = 'true';
	process.env.PLAYWRIGHT_REQUIRE_VISUAL_PREFLIGHT = 'true';
	assertCaptureEnvironment('compare');
	failurePhase = 'MANIFEST';
	const coverageManifest = JSON.parse(readFileSync(ACCEPTED_MANIFEST, 'utf8')) as CaptureManifest;
	failurePhase = 'COVERAGE';
	assertCoverageMatrix(coverageManifest);
	failurePhase = 'MANIFEST';
	const accepted = readManifest(ACCEPTED_ROOT);
	if (accepted.status !== 'ACCEPTED') throw new Error('Expected accepted visual references.');
	assertManifestIntegrity(accepted, ACCEPTED_ROOT);
	assertPinnedVisualRuntime(accepted, 'compare');
	assertVisualRuntimeReady(accepted.runtimeFingerprint ?? {}, VISUAL_PARITY_RUNTIME);
	failurePhase = 'BROWSER';
	const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, ...args], {
		stdio: 'inherit',
		env: process.env,
	});
	if (result.status !== 0)
		throw new Error(`Certified browser suite failed (exit ${result.status}).`);
}

function parseCliFlag(args: string[], name: string): string | undefined {
	const inline = args.find((arg) => arg.startsWith(`${name}=`));
	const positional = args.findIndex((arg) => arg === name);
	return inline?.slice(name.length + 1) ?? (positional >= 0 ? args[positional + 1] : undefined);
}

async function main(): Promise<void> {
	const [operation, ...args] = process.argv.slice(2);
	if (operation === 'browser') return certifiedBrowser(args);
	if (operation === 'diagnose') {
		const { diagnoseSections } = await import('./section-visual-diagnosis.ts');
		return diagnoseSections(args);
	}
	if (operation === 'candidate') {
		return candidate(parseCliFlag(args, '--sha'));
	}
	if (operation === 'compare') return compare();
	if (operation === 'accept') {
		const referenceSha = parseCliFlag(args, '--reference-sha');
		const matrixHash = parseCliFlag(args, '--matrix-hash');
		const candidateManifestSha256 = parseCliFlag(args, '--candidate-manifest-sha256');
		return accept(referenceSha, matrixHash, candidateManifestSha256);
	}
	throw new Error(
		'Usage: visual-parity-cli.ts candidate [--sha=<sha>]|compare|accept [--reference-sha=<sha> --matrix-hash=<hash> --candidate-manifest-sha256=<hash>]|diagnose',
	);
}

if (process.argv[1] && /^visual-parity-cli\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	rmSync(resolve(ROOT, '.tmp/visual-parity-failure.json'), { force: true });
	main().catch((error: unknown) => {
		mkdirSync(resolve(ROOT, '.tmp'), { recursive: true });
		writeFileSync(
			resolve(ROOT, '.tmp/visual-parity-failure.json'),
			JSON.stringify({
				operation: process.argv[2],
				phase: failurePhase,
			}),
		);
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
