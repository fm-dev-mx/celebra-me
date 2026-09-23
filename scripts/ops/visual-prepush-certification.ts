#!/usr/bin/env tsx
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { visualImpactFiles } from './visual-impact.ts';

export const CERTIFICATION_SCHEMA_VERSION = 1;
export const CERTIFICATION_COMMAND_VERSION = 1;
export const PLAYWRIGHT_IMAGE =
	'mcr.microsoft.com/playwright@sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac';
const PNPM_VERSION = '11.23.0';
const ACCEPTED_MANIFEST = 'tests/e2e/visual-baselines/manifest.json';

export interface CertificationIdentity {
	schemaVersion: number;
	commandVersion: number;
	sha: string;
	matrixHash: string;
	acceptedManifestSha256: string;
	lockfileSha256: string;
	playwrightImage: string;
}

export function shouldRequireVisualCertification(
	targetRef: string,
	changedPaths: string[],
): boolean {
	if (targetRef === 'refs/heads/develop' || targetRef === 'refs/heads/main') return true;
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

function sha256(path: string): string {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function assertExactCommit(sha: string, flagName = '--sha'): string {
	if (!/^[0-9a-f]{40}$/u.test(sha))
		throw new Error(`${flagName} must be an exact 40-character SHA.`);
	const resolved = git(['rev-parse', '--verify', `${sha}^{commit}`]);
	if (resolved !== sha) throw new Error(`Requested SHA did not resolve exactly: ${sha}`);
	return resolved;
}

function changedPaths(baseSha: string | undefined, sha: string): string[] {
	if (!baseSha) return [];
	const base = assertExactCommit(baseSha, '--base-sha');
	return git(['diff', '--name-only', '--diff-filter=ACMRD', base, sha])
		.split(/\r?\n/u)
		.filter(Boolean);
}

function identityForCheckout(checkout: string, sha: string): CertificationIdentity {
	const manifestPath = join(checkout, ACCEPTED_MANIFEST);
	if (!existsSync(manifestPath))
		throw new Error(`Missing accepted manifest: ${ACCEPTED_MANIFEST}`);
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { matrixHash?: unknown };
	if (typeof manifest.matrixHash !== 'string' || !/^[0-9a-f]{64}$/u.test(manifest.matrixHash)) {
		throw new Error('Accepted visual manifest has no valid matrixHash.');
	}
	return {
		schemaVersion: CERTIFICATION_SCHEMA_VERSION,
		commandVersion: CERTIFICATION_COMMAND_VERSION,
		sha,
		matrixHash: manifest.matrixHash,
		acceptedManifestSha256: sha256(manifestPath),
		lockfileSha256: sha256(join(checkout, 'pnpm-lock.yaml')),
		playwrightImage: PLAYWRIGHT_IMAGE,
	};
}

function gitPath(relativePath: string): string {
	return resolve(git(['rev-parse', '--path-format=absolute', '--git-path', relativePath]));
}

function runDocker(checkout: string, evidence: string): number {
	const pnpmStore = gitPath('visual-runtime-cache/pnpm');
	const nodeStore = gitPath('visual-runtime-cache/node-v24.14.1');
	mkdirSync(pnpmStore, { recursive: true });
	mkdirSync(nodeStore, { recursive: true });
	mkdirSync(evidence, { recursive: true });
	const command = [
		'set -eu',
		'cp -a /source/. /work',
		'cd /work',
		`trap 'if [ -d test-results ]; then cp -a test-results /evidence/; fi; if [ -d .tmp/visual-parity/compare ]; then mkdir -p /evidence/visual-parity; cp -a .tmp/visual-parity/compare /evidence/visual-parity/; fi' EXIT`,
		'if [ ! -x /node-cache/bin/node ]; then curl -fsSL https://nodejs.org/dist/v24.14.1/node-v24.14.1-linux-x64.tar.gz | tar -xz -C /node-cache --strip-components=1; fi',
		'export PATH=/node-cache/bin:$PATH',
		'corepack enable',
		`corepack prepare pnpm@${PNPM_VERSION} --activate`,
		'pnpm config set store-dir /pnpm-store',
		'pnpm install --frozen-lockfile',
		'touch /evidence/prepush-runtime-ready',
		'pnpm test:e2e:ci --max-failures=5 --workers=2',
	].join(' && ');
	const result = spawnSync(
		'docker',
		[
			'run',
			'--rm',
			'--ipc=host',
			'--mount',
			`type=bind,source=${checkout},target=/source,readonly`,
			'--mount',
			`type=bind,source=${evidence},target=/evidence`,
			'--mount',
			`type=bind,source=${pnpmStore},target=/pnpm-store`,
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
			'VISUAL_PARITY_MODE=compare',
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

function preserveFailureEvidence(evidence: string, sha: string): string {
	const destination = gitPath(`visual-failures/${sha}`);
	rmSync(destination, { recursive: true, force: true });
	mkdirSync(destination, { recursive: true });
	if (existsSync(evidence)) cpSync(evidence, destination, { recursive: true });
	return destination;
}

function hasVisualDiff(root: string): boolean {
	if (!existsSync(root)) return false;
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const path = join(root, entry.name);
		if (entry.isDirectory() && hasVisualDiff(path)) return true;
		if (entry.isFile() && /-(?:actual|diff)\.png$/u.test(entry.name)) return true;
	}
	return false;
}

function main(): void {
	const sha = assertExactCommit(parseFlag('--sha') ?? '');
	const targetRef = parseFlag('--target-ref') ?? 'refs/heads/develop';
	const baseSha = parseFlag('--base-sha');
	const paths = changedPaths(baseSha, sha);
	if (!shouldRequireVisualCertification(targetRef, paths)) {
		console.log('Visual certification is not required for this ref update.');
		return;
	}

	for (const command of [
		['docker', ['version', '--format', '{{.Server.Version}}']],
		['git', ['lfs', 'version']],
	] as const) {
		const result = spawnSync(command[0], command[1], { stdio: 'ignore', shell: false });
		if ((result.status ?? 1) !== 0)
			throw new Error(`${command[0]} ${command[1].join(' ')} is required.`);
	}

	const temporaryRoot = mkdtempSync(join(tmpdir(), 'celebra-me-visual-prepush-'));
	const checkout = join(temporaryRoot, 'checkout');
	const evidence = join(temporaryRoot, 'evidence');
	try {
		execFileSync('git', ['clone', '--no-checkout', process.cwd(), checkout], {
			stdio: 'inherit',
			env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
		});
		execFileSync('git', ['-C', checkout, 'checkout', '--detach', sha], {
			stdio: 'inherit',
			env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
		});
		execFileSync('git', ['-C', checkout, 'lfs', 'pull'], { stdio: 'inherit' });
		const identity = identityForCheckout(checkout, sha);
		const certificationPath = gitPath(`visual-certifications/${sha}.json`);
		if (existsSync(certificationPath)) {
			const cached = JSON.parse(readFileSync(certificationPath, 'utf8')) as unknown;
			if (certificationMatches(cached, identity)) {
				console.log(`Visual certification cache hit for ${sha}.`);
				return;
			}
		}

		const exitCode = runDocker(checkout, evidence);
		if (exitCode !== 0) {
			const evidencePath = preserveFailureEvidence(evidence, sha);
			if (!existsSync(join(evidence, 'prepush-runtime-ready'))) {
				throw new Error(
					`VISUAL_PREFLIGHT_INFRASTRUCTURE: pinned runtime setup failed for ${sha}. Evidence: ${evidencePath}.`,
				);
			}
			if (!hasVisualDiff(evidence)) {
				throw new Error(
					`BROWSER_FAILURE: certified browser checks failed for ${sha} without visual diff evidence. Evidence: ${evidencePath}.`,
				);
			}
			throw new Error(
				`VISUAL_DIFF: certification failed for ${sha}. Evidence: ${evidencePath}. Generate a candidate for this exact SHA; never accept references automatically.`,
			);
		}
		mkdirSync(dirname(certificationPath), { recursive: true });
		writeFileSync(
			certificationPath,
			`${JSON.stringify({ ...identity, certifiedAt: new Date().toISOString() }, null, 2)}\n`,
			'utf8',
		);
		console.log(`Visual certification recorded for ${sha}.`);
	} finally {
		rmSync(temporaryRoot, { recursive: true, force: true });
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
