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
								status: 'ready',
								domain: 'core',
								type: 'refactor',
								subject: {
									verb: 'retire',
									target: 'invitation presenter layers',
								},
								purpose: 'collapse presenter indirection into page-data assembly',
								include: ['src/lib/invitation/page-data.ts'],
								correctionPolicy: 'manual-review',
								messagePreview: {
									header: 'refactor(core): retire invitation presenter layers',
									summary: [
										'collapse presenter indirection into page-data assembly',
									],
								},
							},
						],
						commitStrategyReview: {
							draftedAt: '2026-03-19T09:00:00Z',
							reviewedAt: '2026-03-19T09:20:00Z',
							readyForGatekeeperAt: '2026-03-19T09:30:00Z',
							notes: 'fixture review completed',
						},
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
				status: 'ready',
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
				messagePreview: {
					header: 'refactor(core): retire duplicate invitation layers',
					summary: ['create ambiguity for runtime matching tests'],
				},
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
					messagePreview: {
						header: 'refactor(core): retire invitation presenter layers',
						summary: [
							'collapse presenter indirection into page-data assembly',
							'keep route rendering and fixtures aligned with the same refactor',
						],
					},
				},
			})));
		`);

		expect(scaffold.titleSource).toBe('planned');
		expect(scaffold.header).toBe('refactor(core): retire invitation presenter layers');
		expect(scaffold.summary).toEqual([
			'- collapse presenter indirection into page-data assembly',
			'- keep route rendering and fixtures aligned with the same refactor',
		]);
		expect(scaffold.fullMessage).toContain('Files:');
		expect(scaffold.fullMessage).toContain('- src/lib/invitation/page-data.ts');
		expect(scaffold.trailers).toEqual([
			'Plan-Id: commit-workflow-fixture',
			'Commit-Unit: retire-invitation-layers',
		]);
		expect(scaffold.fullMessage).toContain('Plan-Id: commit-workflow-fixture');
	});

	it('parses inspect verbosity and stage verification flags', () => {
		const args = runNodeJson(`
			import { parseArgs } from './.agent/governance/bin/gatekeeper-workflow.mjs';
			console.log(JSON.stringify(parseArgs([
				'stage',
				'--plan',
				'commit-workflow-fixture',
				'--unit',
				'retire-invitation-layers',
				'--verify-local',
				'--verbose',
			])));
		`);

		expect(args.command).toBe('stage');
		expect(args.plan).toBe('commit-workflow-fixture');
		expect(args.unit).toBe('retire-invitation-layers');
		expect(args.verifyLocal).toBe(true);
		expect(args.verbose).toBe(true);
	});

	it('blocks active executable plans that still contain completed units', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const commitMapPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/commit-map.json',
			);
			const commitMap = JSON.parse(String(readFileSync(commitMapPath, 'utf8')));
			commitMap.units[0].status = 'completed';
			commitMap.units.push({
				id: 'add-new-feature',
				phaseId: '01-refactor',
				status: 'ready',
				domain: 'core',
				type: 'feat',
				subject: {
					verb: 'implement',
					target: 'new invitation feature',
				},
				purpose: 'add a new feature to the invitation system',
				include: ['src/lib/invitation/**'],
				allowRelated: ['tests/**'],
				correctionPolicy: 'absorb-compatible',
				messagePreview: {
					header: 'feat(core): implement new invitation feature',
					summary: ['add a new invitation capability without reviving completed units'],
				},
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
						{ path: 'tests/support/invitation-presenter.fixture.ts', status: 'M' },
					],
				})));
			`);

			expect(result.status).toBe('commit_strategy_not_ready');
			expect(result.errors.join('\n')).toContain('must not contain completed units');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('rejects active-root plans that already use historical manifest statuses', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const manifestPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/manifest.json',
			);
			const manifest = JSON.parse(String(readFileSync(manifestPath, 'utf8')));
			manifest.status = 'COMPLETED';
			writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
		});
		try {
			const result = runNodeJson(`
				import { loadValidatedCommitPlan } from './.agent/governance/bin/commit-plan.mjs';
				console.log(JSON.stringify(loadValidatedCommitPlan('commit-workflow-fixture', ${JSON.stringify(repoRoot)})));
			`);
			expect(result.ok).toBe(false);
			expect(result.reason).toBe('historical_plan_in_active_root');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('rejects allowRelated wildcard "*" during plan validation', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const commitMapPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/commit-map.json',
			);
			const commitMap = JSON.parse(String(readFileSync(commitMapPath, 'utf8')));
			commitMap.units[0].allowRelated = ['*'];
			writeFileSync(commitMapPath, `${JSON.stringify(commitMap, null, 2)}\n`, 'utf8');
		});
		try {
			const result = runNodeJson(`
				import { loadValidatedCommitPlan } from './.agent/governance/bin/commit-plan.mjs';
				console.log(JSON.stringify(loadValidatedCommitPlan('commit-workflow-fixture', ${JSON.stringify(repoRoot)})));
			`);
			expect(result.ok).toBe(false);
			expect(result.errors.join('\n')).toContain('must not use wildcard "*"');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('warns when include patterns of different units semantically overlap', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const commitMapPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/commit-map.json',
			);
			const commitMap = JSON.parse(String(readFileSync(commitMapPath, 'utf8')));
			commitMap.units.push({
				id: 'overlapping-unit',
				phaseId: '01-refactor',
				status: 'ready',
				domain: 'core',
				type: 'refactor',
				subject: {
					verb: 'align',
					target: 'invitation presenter layers',
				},
				purpose: 'test semantic overlap detection',
				include: ['src/lib/invitation/page-data.ts'],
				allowRelated: [],
				correctionPolicy: 'absorb-compatible',
				messagePreview: {
					header: 'refactor(core): align invitation presenter layers',
					summary: ['test semantic overlap detection for ready units'],
				},
			});
			writeFileSync(commitMapPath, `${JSON.stringify(commitMap, null, 2)}\n`, 'utf8');
		});
		try {
			const result = runNodeJson(`
				import { loadValidatedCommitPlan } from './.agent/governance/bin/commit-plan.mjs';
				console.log(JSON.stringify(loadValidatedCommitPlan('commit-workflow-fixture', ${JSON.stringify(repoRoot)})));
			`);
			expect(result.ok).toBe(false);
			expect(result.errors.join('\n')).toContain('semantically overlapping');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});
});
