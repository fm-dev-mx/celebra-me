import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

function runNodeJson(script: string) {
	const result = spawnSync('node', ['--input-type=module', '-e', script], {
		cwd: process.cwd(),
		encoding: 'utf8',
	});
	if ((result.status ?? 1) !== 0) {
		throw new Error(`${result.stdout || ''}\n${result.stderr || ''}`);
	}
	return JSON.parse(String(result.stdout || '').trim());
}

describe('Gatekeeper workflow hardening', () => {
	it('auto-buckets oversized domains into deterministic 12-file splits', () => {
		const result = runNodeJson(`
			import { DomainMapper, loadPolicy } from './.agent/governance/bin/gatekeeper.mjs';
			const mapper = new DomainMapper(loadPolicy('.agent/governance/config/policy.json'));
			const files = Array.from({ length: 20 }, (_, index) =>
				\`.agent/plans/archive/hardening-\${String(index + 1).padStart(2, '0')}.md\`,
			);
			console.log(JSON.stringify(mapper.analyze(files)));
		`);

		expect(result.atomicityLimit).toBe(12);
		expect(result.atomicityPassed).toBe(true);
		expect(result.suggestedSplits.map((entry: { id: string }) => entry.id)).toEqual([
			'gov-plans-archive-1',
			'gov-plans-archive-2',
		]);
		expect(
			result.suggestedSplits.map((entry: { files: string[] }) => entry.files.length),
		).toEqual([12, 8]);
		expect(result.suggestedSplits[0]).toMatchObject({
			baseDomain: 'gov-plans-archive',
			bucketIndex: 1,
			bucketCount: 2,
			autoBucketed: true,
		});
	});

	it('skips strict typecheck for plan-only markdown and json changes', () => {
		const { skipped, required } = runNodeJson(`
			import { loadPolicy, shouldRunTypecheck } from './.agent/governance/bin/gatekeeper.mjs';
			const policy = loadPolicy('.agent/governance/config/policy.json');
			const selectedChecks = new Set(['typecheck']);
			console.log(JSON.stringify({
				skipped: shouldRunTypecheck(
					{ files: ['.agent/plans/archive/plan-a.md', '.agent/plans/archive/plan-a.json'] },
					policy,
					selectedChecks,
					'strict',
				),
				required: shouldRunTypecheck(
					{ files: ['.agent/plans/archive/plan-a.md', 'src/pages/index.astro'] },
					policy,
					selectedChecks,
					'strict',
				),
			}));
		`);

		expect(skipped).toMatchObject({ run: false, status: 'skipped', reason: 'policy_skipped' });
		expect(required).toMatchObject({ run: true, status: 'not_run' });
	});

	it('scopes S0 drift bypass to ignored plan files only', () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'gatekeeper-s0-'));
		const signatureFile = join(tempDir, 's0-signature.json');

		try {
			writeFileSync(
				signatureFile,
				JSON.stringify(
					{
						signature: 'expected-signature',
						files: [
							{
								path: '.agent/plans/archive/plan-a.md',
								sha: 'aaa',
								added: 1,
								deleted: 0,
							},
						],
					},
					null,
					2,
				),
			);

			const { ignoredOnly, blocking, expanded } = runNodeJson(`
				import { loadPolicy, verifyS0Drift } from './.agent/governance/bin/gatekeeper.mjs';
				const policy = loadPolicy('.agent/governance/config/policy.json');
				const signatureFile = ${JSON.stringify(signatureFile.replace(/\\/g, '/'))};
				const ignoredOnly = verifyS0Drift(
					{
						detailedSignature() {
							return {
								signature: 'current-signature',
								files: [{ path: '.agent/plans/archive/plan-a.md', sha: 'bbb', added: 1, deleted: 0 }],
							};
						},
					},
					signatureFile,
					policy,
				);
				const blocking = verifyS0Drift(
					{
						detailedSignature() {
							return {
								signature: 'current-signature',
								files: [{ path: 'src/pages/index.astro', sha: 'ccc', added: 1, deleted: 0 }],
							};
						},
					},
					signatureFile,
					policy,
				);
				const expanded = verifyS0Drift(
					{
						detailedSignature() {
							return {
								signature: 'current-signature',
								files: [
									{ path: '.agent/plans/archive/plan-a.md', sha: 'bbb', added: 1, deleted: 0 },
									{ path: 'src/pages/index.astro', sha: 'ddd', added: 1, deleted: 0 },
								],
							};
						},
					},
					signatureFile,
					policy,
				);
				console.log(JSON.stringify({ ignoredOnly, blocking, expanded }));
			`);

			expect(ignoredOnly.hasDrift).toBe(false);
			expect(ignoredOnly.ignoredOnly).toBe(true);
			expect(blocking.hasDrift).toBe(true);
			expect(blocking.blockingAdded).toEqual(['src/pages/index.astro']);
			expect(expanded.hasDrift).toBe(true);
			expect(expanded.blockingAdded).toEqual(['src/pages/index.astro']);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('builds compact scaffold output within commit budgets', () => {
		const scaffold = runNodeJson(`
			import { buildCommitScaffold } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			const split = {
				id: 'gov-plans-archive-1',
				baseDomain: 'gov-plans-archive',
				files: [
					'.agent/plans/archive/extremely-long-feature-name-with-many-segments/phases/01-very-long-phase-name.md',
					'.agent/plans/archive/extremely-long-feature-name-with-many-segments/manifest.json',
				],
			};
			console.log(JSON.stringify(buildCommitScaffold(split)));
		`);

		expect(scaffold.header.length).toBeLessThanOrEqual(72);
		expect(scaffold.body).toHaveLength(2);
		for (const line of scaffold.body) {
			expect(line.length).toBeLessThanOrEqual(100);
			expect(line.startsWith('- ')).toBe(true);
		}
	});

	it('derives commitlint diff context for grouped atomic commits', () => {
		const result = runNodeJson(`
			import { buildCommitlintContext } from './scripts/validate-commits.mjs';
			const files = [
				'src/assets/images/events/demo-cumple/hero.webp',
				'src/assets/images/events/demo-cumple/gallery-01.webp',
				'src/assets/images/events/demo-cumple/index.ts',
			];
			const entries = [
				{ path: files[0], status: 'A', area: 'asset' },
				{ path: files[1], status: 'A', area: 'asset' },
				{ path: files[2], status: 'A', area: 'source' },
			];
			console.log(JSON.stringify(buildCommitlintContext(files, entries)));
		`);

		expect(result.COMMITLINT_DOMINANT_CHANGE_KIND).toBe('add');
		expect(result.COMMITLINT_DOMINANT_AREA).toBe('asset');
		expect(JSON.parse(result.COMMITLINT_FILE_GROUPS_JSON)).toContainEqual(
			expect.objectContaining({
				key: 'src/assets/images/events/demo-cumple/',
			}),
		);
	});
});
