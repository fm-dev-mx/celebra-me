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
	const repoRoot = mkdtempSync(join(tmpdir(), 'gatekeeper-plan-doctor-'));
	cpSync(FIXTURE_ROOT, repoRoot, { recursive: true });
	if (mutator) mutator(repoRoot);
	return repoRoot.replace(/\\/g, '/');
}

describe('Commit plan doctor', () => {
	it('blocks plans that have not completed the final strategy review', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const commitMapPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/commit-map.json',
			);
			const commitMap = JSON.parse(String(readFileSync(commitMapPath, 'utf8')));
			commitMap.commitStrategyReview = {
				draftedAt: '2026-03-19T09:00:00Z',
			};
			commitMap.units[0].status = 'draft';
			writeFileSync(commitMapPath, `${JSON.stringify(commitMap, null, 2)}\n`, 'utf8');
		});
		try {
			const result = runNodeJson(`
				import { doctorCommitPlan } from './.agent/governance/bin/doctor-commit-plan.mjs';
				console.log(JSON.stringify(doctorCommitPlan({
					repoRootPath: ${JSON.stringify(repoRoot)},
					planId: 'commit-workflow-fixture',
					diffEntries: [{ path: 'src/lib/invitation/page-data.ts', status: 'M' }],
				})));
			`);
			expect(result.status).toBe('blocked');
			expect(result.codes).toContain('strategy_not_reviewed');
			expect(result.codes).toContain('not_ready_for_gatekeeper');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('blocks active plans that already use historical manifest statuses', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const manifestPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/manifest.json',
			);
			const manifest = JSON.parse(String(readFileSync(manifestPath, 'utf8')));
			manifest.status = 'ARCHIVED';
			writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
		});
		try {
			const result = runNodeJson(`
				import { doctorCommitPlan } from './.agent/governance/bin/doctor-commit-plan.mjs';
				console.log(JSON.stringify(doctorCommitPlan({
					repoRootPath: ${JSON.stringify(repoRoot)},
					planId: 'commit-workflow-fixture',
					diffEntries: [{ path: 'src/lib/invitation/page-data.ts', status: 'M' }],
				})));
			`);
			expect(result.status).toBe('blocked');
			expect(result.codes).toContain('historical_plan_in_active_root');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('detects when the current diff spans multiple planned units', () => {
		const repoRoot = withTempPlanFixture((tempRoot) => {
			const commitMapPath = join(
				tempRoot,
				'.agent/plans/commit-workflow-fixture/commit-map.json',
			);
			const commitMap = JSON.parse(String(readFileSync(commitMapPath, 'utf8')));
			commitMap.units.push({
				id: 'document-governance-rules',
				phaseId: '01-refactor',
				status: 'ready',
				domain: 'governance',
				type: 'docs',
				subject: {
					verb: 'document',
					target: 'gatekeeper workflow rules',
				},
				purpose: 'capture workflow rules in the governance guide',
				include: ['docs/core/git-governance.md'],
				allowRelated: [],
				correctionPolicy: 'absorb-compatible',
				messagePreview: {
					header: 'docs(governance): document gatekeeper workflow rules',
					summary: ['capture workflow rules in the governance guide'],
				},
			});
			writeFileSync(commitMapPath, `${JSON.stringify(commitMap, null, 2)}\n`, 'utf8');
		});
		try {
			const result = runNodeJson(`
				import { doctorCommitPlan } from './.agent/governance/bin/doctor-commit-plan.mjs';
				console.log(JSON.stringify(doctorCommitPlan({
					repoRootPath: ${JSON.stringify(repoRoot)},
					planId: 'commit-workflow-fixture',
					diffEntries: [
						{ path: 'src/lib/invitation/page-data.ts', status: 'M' },
						{ path: 'docs/core/git-governance.md', status: 'M' },
					],
				})));
			`);
			expect(result.status).toBe('blocked');
			expect(result.codes).toContain('multiple_units_present');
			expect(result.unitIds).toEqual(
				expect.arrayContaining(['retire-invitation-layers', 'document-governance-rules']),
			);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('detects unmapped files before gatekeeper execution starts', () => {
		const repoRoot = withTempPlanFixture();
		try {
			const result = runNodeJson(`
				import { doctorCommitPlan } from './.agent/governance/bin/doctor-commit-plan.mjs';
				console.log(JSON.stringify(doctorCommitPlan({
					repoRootPath: ${JSON.stringify(repoRoot)},
					planId: 'commit-workflow-fixture',
					diffEntries: [{ path: 'src/lib/rogue-file.ts', status: 'M' }],
				})));
			`);
			expect(result.status).toBe('blocked');
			expect(result.codes).toContain('unmapped_files_present');
			expect(result.sampleFiles.unmapped).toContain('src/lib/rogue-file.ts');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it('detects dirty index and mixed staged drift before inspect', () => {
		const repoRoot = withTempPlanFixture();
		try {
			const result = runNodeJson(`
				import { doctorCommitPlan } from './.agent/governance/bin/doctor-commit-plan.mjs';
				console.log(JSON.stringify(doctorCommitPlan({
					repoRootPath: ${JSON.stringify(repoRoot)},
					planId: 'commit-workflow-fixture',
					diffEntries: [{ path: 'src/lib/invitation/page-data.ts', status: 'M' }],
					stagedEntries: [{ path: 'src/lib/invitation/page-data.ts', status: 'M' }],
					unstagedEntries: [{ path: 'src/lib/invitation/page-data.ts', status: 'M' }],
				})));
			`);
			expect(result.status).toBe('blocked');
			expect(result.codes).toContain('dirty_index');
			expect(result.sampleFiles.mixedStagedUnstaged).toContain(
				'src/lib/invitation/page-data.ts',
			);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});
});
