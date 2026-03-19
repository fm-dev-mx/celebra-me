import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/gatekeeper/plan-aware-basic');

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

function withTempPlanFixture(mutator?: (repoRoot: string) => void) {
	const repoRoot = mkdtempSync(join(tmpdir(), 'gatekeeper-plan-fixture-'));
	cpSync(FIXTURE_ROOT, repoRoot, { recursive: true });
	if (mutator) mutator(repoRoot);
	return repoRoot.replace(/\\/g, '/');
}

describe('Gatekeeper plan-aware workflow', () => {
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

	it('validates commit maps and blocks unsupported correction policies', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const commitMapPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/commit-map.json',
			);
			writeFileSync(
				commitMapPath,
				JSON.stringify(
					{
						planId: 'commit-workflow-fixture',
						mode: 'planned-commits',
						units: [
							{
								id: 'retire-invitation-layers',
								phaseId: '01-refactor',
								status: 'planned',
								domain: 'core',
								type: 'refactor',
								subject: {
									verb: 'retire',
									target: 'invitation presenter layers',
								},
								purpose: 'collapse presenter indirection into page-data assembly',
								include: ['src/lib/invitation/page-data.ts'],
								correctionPolicy: 'manual-review',
							},
						],
					},
					null,
					2,
				),
			);
		});
		try {
			const result = runNodeJson(`
				import { loadValidatedCommitPlan } from './.agent/governance/bin/commit-plan.mjs';
				console.log(JSON.stringify(loadValidatedCommitPlan('commit-workflow-fixture', ${JSON.stringify(repoRoot)})));
			`);
			expect(result.ok).toBe(false);
			expect(result.errors.join('\n')).toContain('correctionPolicy');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('discovers exactly one matching unit from working tree diff entries', () => {
		const repoRoot = withTempPlanFixture();
		try {
			const result = runNodeJson(`
				import { discoverCommitPlanning } from './.agent/governance/bin/commit-plan.mjs';
				console.log(JSON.stringify(discoverCommitPlanning({
					repoRootPath: ${JSON.stringify(repoRoot)},
					planId: 'commit-workflow-fixture',
					diffEntries: [
						{ path: 'src/lib/invitation/page-data.ts', status: 'M' },
						{ path: 'src/lib/presenters/invitation-presenter.ts', status: 'D' },
						{ path: 'src/pages/[eventType]/[slug].astro', status: 'M' },
						{ path: 'tests/support/invitation-presenter.fixture.ts', status: 'M' },
					],
				})));
			`);

			expect(result.status).toBe('matched_unit');
			expect(result.recommendedUnit.id).toBe('retire-invitation-layers');
			expect(result.recommendedUnit.scope).toBe('core');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('rejects overlapping unit definitions before runtime matching', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const commitMapPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/commit-map.json',
			);
			const commitMap = JSON.parse(String(readFileSync(commitMapPath, 'utf8')));
			commitMap.units.push({
				id: 'duplicate-layers',
				phaseId: '01-refactor',
				status: 'planned',
				domain: 'core',
				type: 'refactor',
				subject: {
					verb: 'retire',
					target: 'duplicate invitation layers',
				},
				purpose: 'create ambiguity for testing',
				include: [
					'src/lib/invitation/page-data.ts',
					'src/lib/presenters/invitation-presenter.ts',
					'src/pages/[eventType]/[slug].astro',
				],
				allowRelated: ['tests/**'],
				correctionPolicy: 'absorb-compatible',
			});
			writeFileSync(commitMapPath, `${JSON.stringify(commitMap, null, 2)}\n`, 'utf8');
		});
		try {
			const result = runNodeJson(`
				import { discoverCommitPlanning } from './.agent/governance/bin/commit-plan.mjs';
				console.log(JSON.stringify(discoverCommitPlanning({
					repoRootPath: ${JSON.stringify(repoRoot)},
					planId: 'commit-workflow-fixture',
					diffEntries: [
						{ path: 'src/lib/invitation/page-data.ts', status: 'M' },
						{ path: 'src/lib/presenters/invitation-presenter.ts', status: 'D' },
						{ path: 'src/pages/[eventType]/[slug].astro', status: 'M' },
					],
				})));
			`);

			expect(result.status).toBe('invalid_plan_contract');
			expect(result.errors.join('\n')).toContain('duplicates patterns used by another unit');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('builds planned scaffold output with trailers derived from the unit', () => {
		const scaffold = runNodeJson(`
			import { buildCommitScaffold } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			console.log(JSON.stringify(buildCommitScaffold({
				id: 'retire-invitation-layers',
				files: [
					'src/lib/invitation/page-data.ts',
					'src/lib/presenters/invitation-presenter.ts',
					'src/pages/[eventType]/[slug].astro',
				],
				commitUnit: {
					id: 'retire-invitation-layers',
					planId: 'commit-workflow-fixture',
					domain: 'core',
					type: 'refactor',
					subject: { verb: 'retire', target: 'invitation presenter layers' },
					purpose: 'collapse presenter indirection into page-data assembly',
				},
			}, {
				diffEntries: [
					{ path: 'src/lib/invitation/page-data.ts', status: 'M', area: 'source' },
					{ path: 'src/lib/presenters/invitation-presenter.ts', status: 'D', area: 'source' },
					{ path: 'src/pages/[eventType]/[slug].astro', status: 'M', area: 'source' },
				],
			})));
		`);

		expect(scaffold.titleSource).toBe('planned');
		expect(scaffold.header).toBe('refactor(core): retire invitation presenter layers');
		expect(scaffold.trailers).toEqual([
			'Plan-Id: commit-workflow-fixture',
			'Commit-Unit: retire-invitation-layers',
		]);
		expect(scaffold.fullMessage).toContain('Plan-Id: commit-workflow-fixture');
	});
});
