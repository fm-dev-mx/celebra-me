#!/usr/bin/env tsx
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { visualImpactFiles } from './visual-impact.ts';
import {
	readCandidateReview,
	type CandidateReview,
} from '../screenshot/visual-candidate-review.ts';

export const CERTIFICATION_SCHEMA_VERSION = 1;
export const CERTIFICATION_COMMAND_VERSION = 3;
export const PLAYWRIGHT_IMAGE =
	'mcr.microsoft.com/playwright@sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac';
export const NODE_VERSION = '24.14.1';
export const NODE_ARCHIVE_SHA256 =
	'ace9fa104992ed0829642629c46ca7bd7fd6e76278cb96c958c4b387d29658ea';
export const PNPM_VERSION = '11.23.0';
export const CERTIFIED_BROWSER_COMMAND = 'pnpm test:e2e:ci --max-failures=5 --workers=2';
const ACCEPTED_MANIFEST = 'tests/e2e/visual-baselines/manifest.json';

export interface CertificationIdentity {
	schemaVersion: number;
	commandVersion: number;
	sha: string;
	matrixHash: string;
	acceptedManifestSha256: string;
	lockfileSha256: string;
	playwrightImage: string;
	nodeVersion: string;
	nodeArchiveSha256: string;
	pnpmVersion: string;
	certifiedBrowserCommand: string;
	runtimeContractHash: string;
}

export function shouldRequireVisualCertification(
	_targetRef: string,
	changedPaths: string[],
): boolean {
	return visualImpactFiles(changedPaths).length > 0;
}

export function certificationMatches(
	value: unknown,
	expected: CertificationIdentity,
): value is CertificationIdentity & { certifiedAt: string } {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	const allowed = new Set([...Object.keys(expected), 'certifiedAt']);
	if (Object.keys(record).some((key) => !allowed.has(key))) return false;
	if (typeof record.certifiedAt !== 'string') return false;
	return Object.entries(expected).every(([key, expectedValue]) => record[key] === expectedValue);
}

export function hasReusableCertification(path: string, identity: CertificationIdentity): boolean {
	try {
		return certificationMatches(JSON.parse(readFileSync(path, 'utf8')), identity);
	} catch {
		return false;
	}
}

export function isolatedGitEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
	const environment = { ...process.env };
	for (const key of Object.keys(environment)) {
		if (key.startsWith('GIT_')) delete environment[key];
	}
	return { ...environment, ...extra };
}

function parseFlag(name: string): string | undefined {
	const args = process.argv.slice(2);
	const inline = args.find((arg) => arg.startsWith(`${name}=`));
	if (inline) return inline.slice(name.length + 1);
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function git(args: string[], cwd = process.cwd()): string {
	return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function assertExactCommit(sha: string, flagName = '--sha'): string {
	if (!/^[0-9a-f]{40}$/u.test(sha))
		throw new Error(`${flagName} must be an exact 40-character SHA.`);
	const resolved = git(['rev-parse', '--verify', `${sha}^{commit}`]);
	if (resolved !== sha) throw new Error(`Requested SHA did not resolve exactly: ${sha}`);
	return resolved;
}

function changedPaths(baseSha: string | undefined, sha: string): string[] {
	if (!baseSha) throw new Error('--base-sha is required for range certification.');
	const base = assertExactCommit(baseSha, '--base-sha');
	return git(['diff', '--name-only', '--diff-filter=ACMRD', base, sha])
		.split(/\r?\n/u)
		.filter(Boolean);
}

function identityForCommit(sha: string): CertificationIdentity {
	const readBlob = (path: string): Buffer => execFileSync('git', ['show', `${sha}:${path}`]);
	const manifestBytes = readBlob(ACCEPTED_MANIFEST);
	const manifest = JSON.parse(manifestBytes.toString('utf8')) as { matrixHash?: unknown };
	if (typeof manifest.matrixHash !== 'string' || !/^[0-9a-f]{64}$/u.test(manifest.matrixHash)) {
		throw new Error('Accepted visual manifest has no valid matrixHash.');
	}
	const runtimeContract = {
		playwrightImage: PLAYWRIGHT_IMAGE,
		nodeVersion: NODE_VERSION,
		nodeArchiveSha256: NODE_ARCHIVE_SHA256,
		pnpmVersion: PNPM_VERSION,
		certifiedBrowserCommand: CERTIFIED_BROWSER_COMMAND,
	};
	return {
		schemaVersion: CERTIFICATION_SCHEMA_VERSION,
		commandVersion: CERTIFICATION_COMMAND_VERSION,
		sha,
		matrixHash: manifest.matrixHash,
		acceptedManifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
		lockfileSha256: createHash('sha256').update(readBlob('pnpm-lock.yaml')).digest('hex'),
		...runtimeContract,
		runtimeContractHash: createHash('sha256')
			.update(JSON.stringify(runtimeContract))
			.digest('hex'),
	};
}

function gitPath(relativePath: string): string {
	return resolve(git(['rev-parse', '--path-format=absolute', '--git-path', relativePath]));
}

/** Prints the duration of one container step so pre-push overhead can be measured per step. */
export function timedContainerStep(label: string, command: string): string {
	return `step_started=$(date +%s) && ${command} && echo "[visual-prepush] ${label} $(( $(date +%s) - step_started ))s"`;
}

function timedHostStep<T>(label: string, step: () => T): T {
	const started = Date.now();
	try {
		return step();
	} finally {
		console.log(`[visual-prepush] ${label} ${Math.round((Date.now() - started) / 1000)}s`);
	}
}

/**
 * Docker volume holding the content-addressed pnpm store. A Linux volume avoids reading every
 * package file through the Docker Desktop file share; pnpm verifies store integrity itself.
 */
export const PNPM_STORE_VOLUME = 'celebra-me-visual-pnpm-store';

/**
 * Packs the isolated checkout into one archive. Extracting a single file inside the container is
 * much faster than copying thousands of files (including LFS references) through the file share.
 */
export function sourceArchiveCommand(
	checkout: string,
	archive: string,
	platform: NodeJS.Platform = process.platform,
): [string, string[]] {
	// Windows ships bsdtar; GNU tar from Git Bash would read "C:" as a remote host.
	const tar =
		platform === 'win32'
			? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
			: 'tar';
	return [tar, ['-cf', archive, '-C', checkout, '.']];
}

function runDocker(
	sourceArchive: string,
	evidence: string,
	sha: string,
	operation: 'candidate' | 'compare',
): number {
	const nodeStore = gitPath('visual-runtime-cache/node-v24.14.1');
	mkdirSync(nodeStore, { recursive: true });
	mkdirSync(evidence, { recursive: true });
	const command = [
		'set -eu',
		timedContainerStep('extract-source', 'tar -xf /source.tar -C /work'),
		'cd /work',
		// A passing compare discards its evidence, so only failures and candidates copy the
		// complete capture output to the host mount.
		`trap 'status=$?; if [ "$status" -ne 0 ] || [ "${operation}" = candidate ]; then if [ -d test-results ]; then cp -a test-results /evidence/; fi; if [ -f .tmp/visual-parity-failure.json ]; then cp .tmp/visual-parity-failure.json /evidence/; fi; if [ -d .tmp/visual-parity/${operation} ]; then mkdir -p /evidence/visual-parity; cp -a .tmp/visual-parity/${operation} /evidence/visual-parity/; fi; for review in candidate-references candidate-diffs; do if [ -d .tmp/visual-parity/$review ]; then mkdir -p /evidence/visual-parity; cp -a .tmp/visual-parity/$review /evidence/visual-parity/; fi; done; fi' EXIT`,
		`if [ ! -x /node-cache/bin/node ] || [ "$(/node-cache/bin/node --version 2>/dev/null || true)" != "v${NODE_VERSION}" ] || [ "$(cat /node-cache/.archive.sha256 2>/dev/null || true)" != "${NODE_ARCHIVE_SHA256}" ]; then find /node-cache -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; curl -fsSL -o /tmp/node.tar.gz https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz; echo "${NODE_ARCHIVE_SHA256}  /tmp/node.tar.gz" | sha256sum -c -; tar -xzf /tmp/node.tar.gz -C /node-cache --strip-components=1; printf '%s' '${NODE_ARCHIVE_SHA256}' > /node-cache/.archive.sha256; rm /tmp/node.tar.gz; fi`,
		'export PATH=/node-cache/bin:$PATH',
		`test "$(node --version)" = "v${NODE_VERSION}"`,
		'corepack enable',
		timedContainerStep('corepack', `corepack prepare pnpm@${PNPM_VERSION} --activate`),
		timedContainerStep(
			'pnpm-install',
			'pnpm install --frozen-lockfile --store-dir /pnpm-store',
		),
		'touch /evidence/prepush-runtime-ready',
		// The isolated checkout may originate on Windows. Preserve its checkout
		// normalization when Git evaluates cleanliness inside the Linux container.
		operation === 'candidate' ? 'git config core.autocrlf true' : 'true',
		// The pinned Playwright image does not ship git-lfs. The host has already
		// verified the materialized exact-SHA checkout, so hide only tracked LFS
		// baselines from the container's otherwise strict cleanliness check.
		operation === 'candidate'
			? "git ls-files -z 'tests/e2e/visual-baselines/*.png' 'tests/e2e/visual-baselines/**/*.png' | git update-index --assume-unchanged -z --stdin"
			: 'true',
		operation === 'candidate' ? 'git status --porcelain=v1 --untracked-files=all' : 'true',
		timedContainerStep(
			'browser',
			operation === 'candidate'
				? `pnpm visual:parity:candidate -- --sha ${sha}`
				: CERTIFIED_BROWSER_COMMAND,
		),
	].join(' && ');
	const result = spawnSync(
		'docker',
		[
			'run',
			'--rm',
			'--ipc=host',
			'--mount',
			`type=bind,source=${sourceArchive},target=/source.tar,readonly`,
			'--mount',
			`type=bind,source=${evidence},target=/evidence`,
			'--mount',
			`type=volume,source=${PNPM_STORE_VOLUME},target=/pnpm-store`,
			'--mount',
			`type=bind,source=${nodeStore},target=/node-cache`,
			'--workdir',
			'/work',
			'--env',
			'CI=true',
			'--env',
			'PLAYWRIGHT_USE_CANONICAL_FIXTURES=true',
			'--env',
			'PLAYWRIGHT_REQUIRE_VISUAL_PREFLIGHT=true',
			'--env',
			`VISUAL_PARITY_MODE=${operation}`,
			'--env',
			`VISUAL_PARITY_OS_IMAGE_DIGEST=${PLAYWRIGHT_IMAGE.slice(PLAYWRIGHT_IMAGE.indexOf('@') + 1)}`,
			'--env',
			'TZ=UTC',
			PLAYWRIGHT_IMAGE,
			'sh',
			'-lc',
			command,
		],
		{ stdio: 'inherit', shell: false },
	);
	if (result.error) throw result.error;
	return result.status ?? 1;
}

export function preserveEvidenceAttempt(evidence: string, root: string): string {
	mkdirSync(root, { recursive: true });
	const destination = mkdtempSync(join(root, 'attempt-'));
	if (existsSync(evidence)) cpSync(evidence, destination, { recursive: true });
	return destination;
}

function preserveFailureEvidence(evidence: string, sha: string): string {
	return preserveEvidenceAttempt(evidence, gitPath(`visual-failures/${sha}`));
}

function preserveCandidateEvidence(evidence: string, sha: string): string {
	const source = join(evidence, 'visual-parity', 'candidate');
	if (!existsSync(source)) throw new Error('Certified candidate output is missing.');
	const destination = preserveEvidenceAttempt(
		join(evidence, 'visual-parity'),
		gitPath(`visual-candidates/${sha}`),
	);
	return join(destination, 'candidate');
}

export function classifyVisualFailure(root: string): string {
	if (!existsSync(join(root, 'prepush-runtime-ready'))) return 'VISUAL_PREFLIGHT_INFRASTRUCTURE';
	const diagnostic = join(root, 'visual-parity-failure.json');
	if (existsSync(diagnostic)) {
		try {
			const { phase } = JSON.parse(readFileSync(diagnostic, 'utf8')) as { phase?: unknown };
			if (
				typeof phase === 'string' &&
				['PREFLIGHT', 'MANIFEST', 'COVERAGE', 'REPORT'].includes(phase)
			)
				return `VISUAL_${phase}_FAILURE`;
		} catch {
			return 'VISUAL_EVIDENCE_INVALID';
		}
	}
	try {
		return visualDifferenceFiles(root).length ? 'VISUAL_DIFF' : 'BROWSER_FAILURE';
	} catch {
		return 'VISUAL_EVIDENCE_INVALID';
	}
}

interface VisualCaptureResult {
	file?: unknown;
	comparisonResult?: unknown;
}

export function visualDifferenceFiles(root: string): string[] {
	const files = new Set<string>();
	for (const manifestName of ['manifest.json', 'pages-manifest.json']) {
		const manifestPath = join(root, 'visual-parity', 'compare', manifestName);
		if (!existsSync(manifestPath)) continue;
		try {
			const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
				captures?: VisualCaptureResult[];
			};
			for (const capture of manifest.captures ?? []) {
				if (capture.comparisonResult === 'FAIL' && typeof capture.file === 'string') {
					files.add(capture.file);
				}
			}
		} catch {
			throw new Error(`Invalid visual comparison manifest: ${manifestName}`);
		}
	}
	return [...files].sort();
}

interface CandidateCaptureEntry {
	file: string;
	sha256?: string;
	kind?: string;
	section?: string;
	variant?: string;
	preset?: string;
	viewport?: string;
}

interface CombinedCandidateManifest {
	status?: string;
	mode?: string;
	totalCaptures?: number;
	referenceSha?: string;
	matrixHash?: string;
	candidateManifestSha256?: string;
	captures?: CandidateCaptureEntry[];
}

function printCategoryList(title: string, items: string[], prefix = '*', max = 8): void {
	if (items.length === 0) return;
	console.log(`  - ${title} (${items.length}):`);
	for (const item of items.slice(0, max)) {
		console.log(`    ${prefix} ${item}`);
	}
	if (items.length > max) console.log(`    ... y ${items.length - max} más`);
}

function categorizeCandidateDiffs(
	candidateManifest: CombinedCandidateManifest,
	acceptedManifest: { captures?: CandidateCaptureEntry[] } | null,
): { newPages: string[]; modifiedPages: string[]; variantDiffs: string[] } {
	const acceptedMap = new Map<string, string>();
	for (const capture of acceptedManifest?.captures ?? []) {
		if (capture.file && capture.sha256) acceptedMap.set(capture.file, capture.sha256);
	}

	const newFiles: string[] = [];
	const modifiedFiles: string[] = [];
	for (const capture of candidateManifest.captures ?? []) {
		if (!acceptedMap.has(capture.file)) {
			newFiles.push(capture.file);
		} else if (acceptedMap.get(capture.file) !== capture.sha256) {
			modifiedFiles.push(capture.file);
		}
	}

	const clean = (path: string): string => path.replace('pages/', '').replace('.png', '');
	return {
		newPages: newFiles.filter((f) => f.startsWith('pages/')).map(clean),
		modifiedPages: modifiedFiles.filter((f) => f.startsWith('pages/')).map(clean),
		variantDiffs: [...newFiles, ...modifiedFiles]
			.filter((f) => !f.startsWith('pages/'))
			.map(clean),
	};
}

/** Review items already exclude gate-passing byte changes. */
export function categorizeCandidateReview(review: CandidateReview): {
	newPages: string[];
	modifiedPages: string[];
	variantDiffs: string[];
} {
	const clean = (path: string): string => path.replace('pages/', '').replace('.png', '');
	const pages = review.items.filter((item) => item.kind === 'page');
	return {
		newPages: pages.filter((item) => item.status === 'new').map((item) => clean(item.file)),
		modifiedPages: pages
			.filter((item) => item.status === 'changed')
			.map((item) => clean(item.file)),
		variantDiffs: review.items
			.filter((item) => item.kind === 'variant')
			.map((item) => clean(item.file)),
	};
}

function printVisualCandidateSummary(candidateDir: string, root: string, sha: string): void {
	const combinedPath = join(candidateDir, 'combined-manifest.json');
	const acceptedPath = join(root, ACCEPTED_MANIFEST);

	if (!existsSync(combinedPath)) {
		console.log(`Certified visual candidate generated for ${sha}: ${candidateDir}`);
		return;
	}

	try {
		const candidateManifest = JSON.parse(
			readFileSync(combinedPath, 'utf8'),
		) as CombinedCandidateManifest;
		const acceptedManifest = existsSync(acceptedPath)
			? (JSON.parse(readFileSync(acceptedPath, 'utf8')) as {
					captures?: CandidateCaptureEntry[];
				})
			: null;

		const review = readCandidateReview(candidateDir);
		const { newPages, modifiedPages, variantDiffs } = review
			? categorizeCandidateReview(review)
			: categorizeCandidateDiffs(candidateManifest, acceptedManifest);
		const totalDiffs = newPages.length + modifiedPages.length + variantDiffs.length;
		const changesUrl = pathToFileURL(resolve(candidateDir, 'changes.html')).href;

		console.log('\n' + '─'.repeat(72));
		console.log(
			`📊 RESUMEN DE CAMBIOS VISUALES (Candidato certificado para ${sha.slice(0, 9)})`,
		);
		console.log('─'.repeat(72));
		console.log(
			`• Total de capturas evaluadas: ${candidateManifest.totalCaptures ?? candidateManifest.captures?.length ?? 0}`,
		);
		console.log(`• Cambios que requieren revisión: ${totalDiffs}`);
		if (review) {
			console.log(
				`• Ruido de render que pasa el gate (se conservan los bytes aceptados): ${review.renderNoise.length}`,
			);
		}

		printCategoryList('Páginas nuevas provisionadas', newPages, '+');
		printCategoryList('Páginas completas modificadas', modifiedPages, '~');
		printCategoryList('Variantes de sección afectadas', variantDiffs, '*');

		console.log('─'.repeat(72));
		console.log(`🔗 Reporte visual interactivo (Antes vs Candidato):`);
		console.log(`   ${changesUrl}`);
		console.log('─'.repeat(72));
		console.log(`✅ Para aceptar estos cambios tras tu revisión:`);
		console.log(`   pnpm visual:parity:accept\n`);
	} catch (error) {
		console.log(`Certified visual candidate generated for ${sha}: ${candidateDir}`);
		console.error('No se pudo generar el resumen visual:', error);
	}
}

function assertHostPrerequisites(): void {
	for (const command of [
		['docker', ['version', '--format', '{{.Server.Version}}']],
		['git', ['lfs', 'version']],
	] as const) {
		const result = spawnSync(command[0], command[1], { stdio: 'ignore', shell: false });
		if ((result.status ?? 1) !== 0)
			throw new Error(`${command[0]} ${command[1].join(' ')} is required.`);
	}
}

function materializeCandidateWorkspace(evidence: string, root: string, sha: string): void {
	preserveCandidateEvidence(evidence, sha);

	const targetTmp = resolve(root, '.tmp/visual-parity');
	mkdirSync(targetTmp, { recursive: true });

	const sourceCandidate = join(evidence, 'visual-parity', 'candidate');
	const targetCandidate = join(targetTmp, 'candidate');
	if (existsSync(targetCandidate)) rmSync(targetCandidate, { recursive: true, force: true });
	cpSync(sourceCandidate, targetCandidate, { recursive: true });

	for (const sibling of ['candidate-references', 'candidate-diffs']) {
		const source = join(evidence, 'visual-parity', sibling);
		const target = join(targetTmp, sibling);
		if (existsSync(target)) rmSync(target, { recursive: true, force: true });
		if (existsSync(source)) cpSync(source, target, { recursive: true });
	}

	printVisualCandidateSummary(targetCandidate, root, sha);
}

function main(): void {
	const sha = assertExactCommit(parseFlag('--sha') ?? '');
	const repositoryRoot = git(['rev-parse', '--show-toplevel']);
	const candidateMode = process.argv.slice(2).includes('--candidate');
	const targetRef = parseFlag('--target-ref') ?? 'refs/heads/develop';
	const baseSha = parseFlag('--base-sha');
	const paths = candidateMode ? [] : changedPaths(baseSha, sha);
	if (!candidateMode && !shouldRequireVisualCertification(targetRef, paths)) {
		console.log('Visual certification is not required for this ref update.');
		return;
	}
	const identity = candidateMode ? undefined : identityForCommit(sha);
	const certificationPath = gitPath(`visual-certifications/${sha}.json`);
	if (identity && hasReusableCertification(certificationPath, identity)) {
		console.log(`Visual certification cache hit for ${sha}.`);
		return;
	}

	assertHostPrerequisites();

	const temporaryRoot = mkdtempSync(join(tmpdir(), 'celebra-me-visual-prepush-'));
	const checkout = join(temporaryRoot, 'checkout');
	const evidence = join(temporaryRoot, 'evidence');
	let cleanup = true;
	try {
		timedHostStep('clone', () =>
			execFileSync('git', ['clone', '--no-checkout', repositoryRoot, checkout], {
				stdio: 'inherit',
				env: isolatedGitEnvironment({ GIT_LFS_SKIP_SMUDGE: '1' }),
			}),
		);
		execFileSync('git', ['-C', checkout, 'checkout', '--detach', sha], {
			stdio: 'inherit',
			env: isolatedGitEnvironment({ GIT_LFS_SKIP_SMUDGE: '1' }),
		});
		timedHostStep('lfs-pull', () =>
			execFileSync('git', ['-C', checkout, 'lfs', 'pull'], {
				stdio: 'inherit',
				env: isolatedGitEnvironment(),
			}),
		);
		const isolatedStatus = execFileSync(
			'git',
			['-C', checkout, 'status', '--porcelain=v1', '--untracked-files=all'],
			{ encoding: 'utf8', env: isolatedGitEnvironment() },
		).trim();
		if (isolatedStatus) {
			throw new Error(
				`Isolated exact-SHA checkout is not clean after Git LFS materialization:\n${isolatedStatus}`,
			);
		}
		const sourceArchive = join(temporaryRoot, 'source.tar');
		timedHostStep('archive-source', () => {
			const [tar, args] = sourceArchiveCommand(checkout, sourceArchive);
			execFileSync(tar, args, { stdio: 'inherit' });
		});
		if (candidateMode) {
			const exitCode = timedHostStep('docker', () =>
				runDocker(sourceArchive, evidence, sha, 'candidate'),
			);
			if (exitCode !== 0) {
				const category = classifyVisualFailure(evidence);
				throw new Error(`${category}: candidate generation failed for ${sha}.`);
			}
			materializeCandidateWorkspace(evidence, repositoryRoot, sha);
			return;
		}
		const exitCode = timedHostStep('docker', () =>
			runDocker(sourceArchive, evidence, sha, 'compare'),
		);
		if (exitCode !== 0) {
			const category = classifyVisualFailure(evidence);
			const hint =
				category === 'VISUAL_DIFF'
					? `\n💡 Para generar el candidato certificado e inspeccionar visualmente los cambios:\n   pnpm visual:parity:candidate:certified -- --sha ${sha}`
					: '';
			throw new Error(
				`${category}: certification failed for ${sha}. Never accept references automatically.${hint}`,
			);
		}
		mkdirSync(dirname(certificationPath), { recursive: true });
		writeFileSync(
			certificationPath,
			`${JSON.stringify({ ...identity, certifiedAt: new Date().toISOString() }, null, 2)}\n`,
			'utf8',
		);
		console.log(`Visual certification recorded for ${sha}.`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		let evidencePath: string;
		try {
			evidencePath = preserveFailureEvidence(evidence, sha);
		} catch (preservationError) {
			cleanup = false;
			throw new Error(
				`${message} Evidence preservation failed; original retained at ${temporaryRoot}.`,
				{ cause: preservationError },
			);
		}
		throw new Error(`${message} Evidence: ${evidencePath}.`, { cause: error });
	} finally {
		if (cleanup) rmSync(temporaryRoot, { recursive: true, force: true });
	}
}

if (
	process.argv[1] &&
	/^visual-prepush-certification\.(?:ts|js)$/u.test(basename(process.argv[1]))
) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
