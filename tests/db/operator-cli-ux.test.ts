import { describe, expect, it } from '@jest/globals';
import {
	NO_PRODUCTION_CHANGES,
	formatOperatorFailure,
	formatPhaseSummary,
	labelAuthRequirement,
	labelBackupRequirement,
	parsePorcelainDirtyFiles,
	shortSha,
} from '../../scripts/db/operator-cli-ux.ts';
import { buildMigrationPlan } from '../../scripts/db/migration-plan.ts';
import {
	formatPlanReview,
	formatPlanReviewCompact,
} from '../../scripts/db/migrate-plan-format.ts';

describe('operator-cli-ux', () => {
	it('formats failures with status, remediation, retry, and code last', () => {
		const text = formatOperatorFailure(
			{
				title: 'Árbol de trabajo con cambios',
				cause: 'Hay archivos locales sin commit.',
				code: 'DIRTY_WORKTREE',
				remediation: [
					'Revise y confirme los cambios',
					'Haga commit',
					'Ejecute pnpm release-check',
					'Reintente',
				],
				retryCommand: 'pnpm release-check && pnpm db:prod:migrate',
				affected: {
					label: 'Archivos afectados',
					items: ['scripts/db/owner-production-apply.ts', 'README.md'],
				},
			},
			{ NO_COLOR: '1' },
		);
		expect(text).toContain('Árbol de trabajo con cambios');
		expect(text).toContain('Hay archivos locales sin commit.');
		expect(text).toContain(NO_PRODUCTION_CHANGES);
		expect(text).toContain('Archivos afectados (2):');
		expect(text).toContain('- scripts/db/owner-production-apply.ts');
		expect(text).toContain('Reintento: pnpm release-check && pnpm db:prod:migrate');
		expect(text.trimEnd().endsWith('Código: DIRTY_WORKTREE')).toBe(true);
	});

	it('parses porcelain paths for multiline dirty lists', () => {
		expect(
			parsePorcelainDirtyFiles(' M scripts/a.ts\n?? docs/b.md\nR  old.ts -> new.ts\n'),
		).toEqual(['scripts/a.ts', 'docs/b.md', 'old.ts → new.ts']);
	});

	it('shortens hashes and labels policy enums for compact cards', () => {
		expect(shortSha('abcdef0123456789')).toBe('abcdef01…');
		expect(labelAuthRequirement('production_owner_tty')).toContain('propietario');
		expect(labelBackupRequirement('prod_critical_pre_post')).toContain('crítico');
		expect(formatPhaseSummary({ '20260101000000': 'expand' }, ['20260101000000'])).toBe(
			'20260101000000 (expand)',
		);
	});
});

describe('migrate plan presentation', () => {
	const plan = buildMigrationPlan({
		target: 'production',
		mode: 'preflight',
		sourceHead: 'abcdef0123456789deadbeef',
		redactedTargetIdentity: 'production:postgresql://***@db.example.supabase.co:5432/postgres',
		pendingVersions: ['20260730220544'],
		expectedPin: null,
		phaseByVersion: { '20260730220544': 'expand' },
		compatibilityStatus: 'allow',
		compatibilityReasons: ['ok'],
		releaseIdentity: { kind: 'head', value: 'abcdef0123456789deadbeef' },
		deployedAppIdentity: { sha: null, capabilities: [] },
		authRequirement: 'production_owner_tty',
		backupRequirement: 'prod_critical_pre_post',
		executor: 'supabase_cli_push',
		verificationRequirement: 'history_and_mutation_contract',
		releaseEvidenceSha: null,
	});

	it('keeps compact cards free of URLs, full hashes, executors, and raw policy names', () => {
		const compact = formatPlanReviewCompact(plan);
		expect(compact).toContain('Production');
		expect(compact).toContain('20260730220544 (expand)');
		expect(compact).toContain('Compatible');
		expect(compact).not.toContain('supabase.co');
		expect(compact).not.toContain('supabase_cli_push');
		expect(compact).not.toContain('production_owner_tty');
		expect(compact).not.toContain('prod_critical_pre_post');
		expect(compact).not.toContain(plan.planId);
		expect(compact).not.toContain(plan.sourceHead);
	});

	it('exposes technical identifiers in full review', () => {
		const full = formatPlanReview(plan);
		expect(full).toContain(plan.planId);
		expect(full).toContain('supabase_cli_push');
		expect(full).toContain('production_owner_tty');
		expect(full).toContain(plan.sourceHead);
	});
});
