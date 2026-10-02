import {
	CERTIFICATION_COMMAND_VERSION,
	CERTIFICATION_SCHEMA_VERSION,
	CERTIFIED_BROWSER_COMMAND,
	NODE_ARCHIVE_SHA256,
	NODE_VERSION,
	PNPM_VERSION,
	PLAYWRIGHT_IMAGE,
	certificationMatches,
	isolatedGitEnvironment,
	shouldRequireVisualCertification,
	visualDifferenceFiles,
	classifyVisualFailure,
	preserveEvidenceAttempt,
	hasReusableCertification,
	categorizeCandidateReview,
	timedContainerStep,
	sourceArchiveCommand,
	PNPM_STORE_VOLUME,
} from '../../scripts/ops/visual-prepush-certification.ts';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const identity = {
	schemaVersion: CERTIFICATION_SCHEMA_VERSION,
	commandVersion: CERTIFICATION_COMMAND_VERSION,
	sha: 'a'.repeat(40),
	matrixHash: 'b'.repeat(64),
	acceptedManifestSha256: 'c'.repeat(64),
	lockfileSha256: 'd'.repeat(64),
	playwrightImage: PLAYWRIGHT_IMAGE,
	nodeVersion: NODE_VERSION,
	nodeArchiveSha256: NODE_ARCHIVE_SHA256,
	pnpmVersion: PNPM_VERSION,
	certifiedBrowserCommand: CERTIFIED_BROWSER_COMMAND,
	runtimeContractHash: 'e'.repeat(64),
};

describe('visual pre-push certification', () => {
	it('recovers from missing or corrupt cache by requiring fresh certification', () => {
		const root = mkdtempSync(join(tmpdir(), 'visual-cache-'));
		const path = join(root, 'cache.json');
		try {
			expect(hasReusableCertification(path, identity)).toBe(false);
			writeFileSync(path, '{');
			expect(hasReusableCertification(path, identity)).toBe(false);
			writeFileSync(
				path,
				JSON.stringify({ ...identity, certifiedAt: '2026-09-28T00:00:00.000Z' }),
			);
			expect(hasReusableCertification(path, identity)).toBe(true);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
	it.each(Object.keys(identity))('invalidates a cached certification when %s changes', (key) => {
		const cached = { ...identity, certifiedAt: '2026-09-28T00:00:00.000Z', [key]: 'changed' };
		expect(certificationMatches(cached, identity)).toBe(false);
	});

	it('preserves distinct attempts and diagnoses recoverable infrastructure without hiding evidence failures', () => {
		const root = mkdtempSync(join(tmpdir(), 'visual-attempt-test-'));
		const evidence = join(root, 'evidence');
		mkdirSync(evidence);
		try {
			expect(classifyVisualFailure(evidence)).toBe('VISUAL_PREFLIGHT_INFRASTRUCTURE');
			writeFileSync(join(evidence, 'prepush-runtime-ready'), '');
			for (const phase of ['PREFLIGHT', 'COVERAGE', 'MANIFEST', 'REPORT']) {
				writeFileSync(
					join(evidence, 'visual-parity-failure.json'),
					JSON.stringify({ phase }),
				);
				expect(classifyVisualFailure(evidence)).toBe(`VISUAL_${phase}_FAILURE`);
			}
			const first = preserveEvidenceAttempt(evidence, join(root, 'saved'));
			writeFileSync(join(evidence, 'visual-parity-failure.json'), '{');
			const second = preserveEvidenceAttempt(evidence, join(root, 'saved'));
			expect(first).not.toBe(second);
			expect(classifyVisualFailure(first)).toBe('VISUAL_REPORT_FAILURE');
			expect(classifyVisualFailure(second)).toBe('VISUAL_EVIDENCE_INVALID');
			expect(readFileSync(join(second, 'visual-parity-failure.json'), 'utf8')).toBe('{');
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
	it('skips full certification for nonvisual changes on protected branches', () => {
		expect(shouldRequireVisualCertification('refs/heads/develop', [])).toBe(false);
		expect(shouldRequireVisualCertification('refs/heads/main', ['docs/readme.md'])).toBe(false);
	});

	it('keeps the candidate wrapper bound to the exact certified browser runtime', () => {
		expect(CERTIFIED_BROWSER_COMMAND).toBe('pnpm test:e2e:ci --max-failures=5 --workers=2');
		expect(NODE_ARCHIVE_SHA256).toMatch(/^[0-9a-f]{64}$/u);
	});

	it('requires certification only for visual impact pushed to develop or main', () => {
		expect(
			shouldRequireVisualCertification('refs/heads/develop', ['src/styles/app.scss']),
		).toBe(true);
		expect(shouldRequireVisualCertification('refs/heads/main', ['src/styles/app.scss'])).toBe(
			true,
		);
		expect(
			shouldRequireVisualCertification('refs/heads/feat/example', ['src/styles/app.scss']),
		).toBe(false);
	});

	it('fails closed when certification identity drifts or contains unknown fields', () => {
		const valid = { ...identity, certifiedAt: '2026-09-23T00:00:00.000Z' };
		expect(certificationMatches(valid, identity)).toBe(true);
		expect(certificationMatches({ ...valid, matrixHash: 'e'.repeat(64) }, identity)).toBe(
			false,
		);
		expect(certificationMatches({ ...valid, unexpected: true }, identity)).toBe(false);
	});

	it('reads visual differences only from structured comparison manifests', () => {
		const root = mkdtempSync(join(tmpdir(), 'visual-certification-test-'));
		const compare = join(root, 'visual-parity', 'compare');
		mkdirSync(compare, { recursive: true });
		writeFileSync(
			join(compare, 'manifest.json'),
			JSON.stringify({
				captures: [
					{ file: 'variant-pass.png', comparisonResult: 'PASS' },
					{ file: 'variant-fail.png', comparisonResult: 'FAIL' },
				],
			}),
		);
		writeFileSync(
			join(compare, 'pages-manifest.json'),
			JSON.stringify({
				captures: [{ file: 'pages/page-fail.png', comparisonResult: 'FAIL' }],
			}),
		);
		try {
			expect(visualDifferenceFiles(root)).toEqual([
				'pages/page-fail.png',
				'variant-fail.png',
			]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('removes hook-owned Git variables from isolated clone commands', () => {
		const originalGitDir = process.env.GIT_DIR;
		const originalGitWorkTree = process.env.GIT_WORK_TREE;
		process.env.GIT_DIR = 'hook-git-dir';
		process.env.GIT_WORK_TREE = 'hook-work-tree';
		try {
			const environment = isolatedGitEnvironment({ GIT_LFS_SKIP_SMUDGE: '1' });
			expect(environment.GIT_DIR).toBeUndefined();
			expect(environment.GIT_WORK_TREE).toBeUndefined();
			expect(environment.GIT_LFS_SKIP_SMUDGE).toBe('1');
			expect(environment.Path ?? environment.PATH).toBe(process.env.Path ?? process.env.PATH);
		} finally {
			if (originalGitDir === undefined) delete process.env.GIT_DIR;
			else process.env.GIT_DIR = originalGitDir;
			if (originalGitWorkTree === undefined) delete process.env.GIT_WORK_TREE;
			else process.env.GIT_WORK_TREE = originalGitWorkTree;
		}
	});
});

describe('certification reporting', () => {
	it('times a container step without hiding its exit status', () => {
		const step = timedContainerStep('pnpm-install', 'pnpm install --frozen-lockfile');
		expect(
			step.startsWith('step_started=$(date +%s) && pnpm install --frozen-lockfile && echo '),
		).toBe(true);
		expect(step).toContain('[visual-prepush] pnpm-install');
	});

	it('summarizes only review items, never gate-passing render noise', () => {
		const item = (file: string, kind: 'variant' | 'page', status: 'changed' | 'new') => ({
			file,
			kind,
			status,
			label: file,
			viewport: 'mobile',
			preset: 'p',
			sha256: 'x',
		});
		expect(
			categorizeCandidateReview({
				candidateManifestSha256: 'm',
				items: [
					item('pages/demo-xv-a-mobile.png', 'page', 'new'),
					item('pages/invitation-xv-b-mobile.png', 'page', 'changed'),
					item('jewelry-box-mobile-hero-standard.png', 'variant', 'changed'),
				],
				renderNoise: ['pages/invitation-xv-c-mobile.png'],
				removed: [],
			}),
		).toEqual({
			newPages: ['demo-xv-a-mobile'],
			modifiedPages: ['invitation-xv-b-mobile'],
			variantDiffs: ['jewelry-box-mobile-hero-standard'],
		});
	});
});

describe('certification container inputs', () => {
	it('archives the checkout with bsdtar on Windows and tar elsewhere', () => {
		expect(sourceArchiveCommand('/tmp/checkout', '/tmp/source.tar', 'linux')).toEqual([
			'tar',
			['-cf', '/tmp/source.tar', '-C', '/tmp/checkout', '.'],
		]);
		const [windowsTar, args] = sourceArchiveCommand('C:/checkout', 'C:/s.tar', 'win32');
		expect(windowsTar.replaceAll('\\', '/').toLowerCase().endsWith('/system32/tar.exe')).toBe(
			true,
		);
		expect(args).toEqual(['-cf', 'C:/s.tar', '-C', 'C:/checkout', '.']);
	});

	it('keeps the pnpm store in a named Docker volume', () => {
		expect(PNPM_STORE_VOLUME).toMatch(/^[a-z0-9][a-z0-9_.-]+$/u);
	});
});
