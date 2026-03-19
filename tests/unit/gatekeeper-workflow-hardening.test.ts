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
	it('resolves configured pre-flight commands only when they are runnable in the repo', () => {
		const result = runNodeJson(`
			import { resolvePreflightCommand, resolveRunnablePnpmCommand } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			console.log(JSON.stringify({
				missingConfigured: resolvePreflightCommand({
					workflow: {
						inspect: {
							preflightCommand: 'pnpm missing-script',
							preflightFallbacks: ['pnpm ci'],
						},
					},
				}),
				shellFallback: resolvePreflightCommand({
					workflow: {
						inspect: {
							preflightCommand: 'node scripts/check.js',
							preflightFallbacks: [],
						},
					},
				}),
				runnableScript: resolveRunnablePnpmCommand('pnpm ci', { ci: 'pnpm lint' }),
				missingScript: resolveRunnablePnpmCommand('pnpm missing-script', { ci: 'pnpm lint' }),
			}));
		`);

		expect(result.missingConfigured).toBe('pnpm ci');
		expect(result.shellFallback).toBe('node scripts/check.js');
		expect(result.runnableScript).toBe('pnpm ci');
		expect(result.missingScript).toBeNull();
	});

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

	it('matches english governance globs with nested and top-level paths', () => {
		const result = runNodeJson(`
			import { matchAny } from './.agent/governance/bin/gatekeeper.mjs';
			console.log(JSON.stringify({
				docsRoot: matchAny('docs/tmp-gatekeeper-spanish.md', ['docs/**/*.md']),
				scriptsRoot: matchAny('scripts/tmp-gatekeeper-spanish.mjs', ['scripts/**/*.mjs']),
				srcBrace: matchAny('src/lib/rsvp/service.ts', ['src/**/*.{ts,tsx,astro,mjs,jsx}']),
			}));
		`);

		expect(result).toEqual({
			docsRoot: true,
			scriptsRoot: true,
			srcBrace: true,
		});
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

	it('builds scaffold output with full paths and exact per-file metadata', () => {
		const scaffold = runNodeJson(`
			import { buildCommitScaffold } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			const split = {
				id: 'gov-plans-archive-1',
				baseDomain: 'gov-plans-archive',
				files: [
					'.agent/plans/archive/extremely-long-feature-name/phases/01-delivery.md',
					'.agent/plans/archive/extremely-long-feature-name/manifest.json',
				],
			};
			console.log(JSON.stringify(buildCommitScaffold(split)));
		`);

		expect(scaffold.header.length).toBeLessThanOrEqual(130);
		expect(scaffold.body).toHaveLength(2);
		expect(scaffold.titleSource).toBe('deterministic');
		expect(
			scaffold.body[0].startsWith(
				'- .agent/plans/archive/extremely-long-feature-name/phases/01-delivery.md: ',
			),
		).toBe(true);
		expect(
			scaffold.body[1].startsWith(
				'- .agent/plans/archive/extremely-long-feature-name/manifest.json: ',
			),
		).toBe(true);
		for (const line of scaffold.body) {
			const [pathSpec] = line.replace(/^- /, '').split(': ', 1);
			expect(pathSpec).not.toContain('...');
		}
	});

	it('keeps scaffold non-mutating by default and exposes explicit commit mode', () => {
		const result = runNodeJson(`
			import { parseArgs } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			console.log(JSON.stringify({
				scaffold: parseArgs(['scaffold', '--domain', 'core']),
				commit: parseArgs(['commit', '--domain', 'core']),
				scaffoldCommit: parseArgs(['scaffold', '--domain', 'core', '--commit']),
			}));
		`);

		expect(result.scaffold.command).toBe('scaffold');
		expect(result.scaffold.commit).toBe(false);
		expect(result.commit.command).toBe('commit');
		expect(result.commit.commit).toBe(false);
		expect(result.scaffoldCommit.commit).toBe(true);
	});

	it('prefers dominant code changes in mixed presenter splits', () => {
		const scaffold = runNodeJson(`
			import { buildCommitScaffold } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			const split = {
				id: 'core',
				baseDomain: 'core',
				files: [
					'.agent/plans/pre-phase-audit-2026/CHANGELOG.md',
					'src/components/invitation/InvitationSections.astro',
					'src/lib/presenters/invitation-presenter.ts',
					'src/pages/[eventType]/[slug].astro',
					'tests/unit/invitation.presenter.test.ts',
				],
			};
			console.log(JSON.stringify(buildCommitScaffold(split)));
		`);

		expect(scaffold.header).toBe('feat(core): implement invitation presenter-driven route');
		expect(scaffold.header).not.toContain('plan');
		expect(scaffold.header).not.toContain('files');
	});

	it('generates specific plan and presenter bullet descriptions', () => {
		const result = runNodeJson(`
			import { describeFileChange } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			console.log(JSON.stringify({
				changelog: describeFileChange('.agent/plans/pre-phase-audit-2026/CHANGELOG.md'),
				manifest: describeFileChange('.agent/plans/pre-phase-audit-2026/manifest.json'),
				phase: describeFileChange('.agent/plans/pre-phase-audit-2026/phases/04-presenter-implementation.md'),
				presenter: describeFileChange('src/lib/presenters/invitation-presenter.ts'),
				page: describeFileChange('src/pages/[eventType]/[slug].astro', {
					dominantCluster: { kind: 'presenter-route' },
				}),
				testFile: describeFileChange('tests/unit/invitation.presenter.test.ts'),
			}));
		`);

		expect(result.changelog).toBe('Update changelog to/for architectural purpose');
		expect(result.manifest).toBe('Update manifest to/for architectural purpose');
		expect(result.phase).toBe(
			'Update 04 presenter implementation to/for architectural purpose',
		);
		expect(result.presenter).toBe('Align invitation presenter to/for architectural purpose');
		expect(result.page).toBe('Implement slug to/for architectural purpose');
		expect(result.testFile).toBe(
			'Align invitation presenter test to/for architectural purpose',
		);
	});

	it('avoids generic scaffold targets and descriptions for presenter-heavy splits', () => {
		const scaffold = runNodeJson(`
			import { buildCommitScaffold } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			const split = {
				id: 'core',
				baseDomain: 'core',
				files: [
					'src/lib/presenters/invitation-presenter.ts',
					'src/pages/[eventType]/[slug].astro',
				],
			};
			console.log(JSON.stringify(buildCommitScaffold(split)));
		`);

		expect(scaffold.header).not.toMatch(/\b(files|changes|work)\b/);
		for (const line of scaffold.body as string[]) {
			expect(line).not.toMatch(/update file configuration/i);
			expect(line).not.toContain('...');
			expect(line.length).toBeLessThanOrEqual(140);
		}
	});

	it('skips AI title assist for simple high-confidence splits even when configured', () => {
		const result = runNodeJson(`
			import { resolveCommitScaffold } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			const split = {
				id: 'core',
				baseDomain: 'core',
				files: [
					'src/lib/presenters/invitation-presenter.ts',
					'src/pages/[eventType]/[slug].astro',
				],
			};
			const outcome = await resolveCommitScaffold(split, {
				policy: {
					workflow: {
						commit: {
							aiTitle: {
								enabled: true,
								mode: 'assist',
								confidenceThreshold: 0.95,
								timeoutMs: 1000,
							},
						},
					},
				},
				env: {
					GATEKEEPER_AI_TITLE_ENDPOINT: 'https://example.invalid',
					GATEKEEPER_AI_TITLE_MODEL: 'fake-model',
					GATEKEEPER_AI_TITLE_API_KEY: 'fake-key',
				},
				fetchImpl: async () => {
					throw new Error('AI should not be called for a high-confidence split');
				},
			});
			console.log(JSON.stringify(outcome.scaffold));
		`);

		expect(result.titleSource).toBe('deterministic');
		expect(result.header).toBe('feat(core): implement invitation presenter-driven route');
	});

	it('falls back to deterministic titles when AI returns an invalid subject', () => {
		const result = runNodeJson(`
			import { resolveCommitScaffold } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			const split = {
				id: 'core',
				baseDomain: 'core',
				files: [
					'docs/core/architecture.md',
					'src/lib/presenters/invitation-presenter.ts',
					'src/pages/[eventType]/[slug].astro',
				],
			};
			const outcome = await resolveCommitScaffold(split, {
				policy: {
					workflow: {
						commit: {
							aiTitle: {
								enabled: true,
								mode: 'assist',
								confidenceThreshold: 0.95,
								timeoutMs: 1000,
							},
						},
					},
				},
				env: {
					GATEKEEPER_AI_TITLE_ENDPOINT: 'https://example.invalid',
					GATEKEEPER_AI_TITLE_MODEL: 'fake-model',
					GATEKEEPER_AI_TITLE_API_KEY: 'fake-key',
				},
				fetchImpl: async () => ({
					ok: true,
					async json() {
						return {
							subject: 'update files',
							confidence: 0.99,
							rationale: 'bad generic title',
						};
					},
				}),
			});
			console.log(JSON.stringify(outcome.scaffold));
		`);

		expect(result.titleSource).toBe('deterministic');
		expect(result.finalSubject).toBe('implement invitation presenter-driven route');
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

	it('builds scaffold headers without process bookkeeping language', () => {
		const result = runNodeJson(`
			import { buildCommitScaffold } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			const split = {
				id: 'gov-plans-archive-1',
				baseDomain: 'gov-plans-archive',
				files: [
					'.agent/plans/archive/gatekeeper-hardening-fixture/01-phase.md',
					'.agent/plans/archive/gatekeeper-hardening-fixture/02-manifest.json',
				],
			};
			console.log(JSON.stringify(buildCommitScaffold(split)));
		`);

		expect(result.type).toBe('docs');
		expect(result.header).toMatch(/^docs\(gov-plans-archive-1\): archive /);
		expect(result.header.length).toBeLessThanOrEqual(130);
		expect(result.fullMessage).not.toContain('record gov plans archive scope');
		expect(result.body[0]).toMatch(/- .+: [A-Z][a-z]+ .+ to\/for .+/);
	});
});
