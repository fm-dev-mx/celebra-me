import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';

describe('Preview perimeter helpers', () => {
	it('assertPreviewDbUrl accepts only the canonical Preview project ref', async () => {
		const { assertPreviewDbUrl } = await import('../../scripts/db/db-workflow-lib.ts');
		const previewUrl = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REFS.preview}.supabase.co:5432/postgres`;
		expect(() => assertPreviewDbUrl(previewUrl)).not.toThrow();

		const productionUrl = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REFS.production}.supabase.co:5432/postgres`;
		expect(() => assertPreviewDbUrl(productionUrl)).toThrow(
			/Refusing PREVIEW_DB_URL|expected project/,
		);

		expect(() =>
			assertPreviewDbUrl('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
		).toThrow(/Refusing PREVIEW_DB_URL|Cannot extract Supabase project reference/);
	});

	it('preview migrate policy imports assertPreviewDbUrl and clean-HEAD override', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/migrate-policy-preview.ts'),
			'utf8',
		);
		expect(source).toMatch(/assertPreviewDbUrl/);
		expect(source).toMatch(/assertCleanGitWorktree/);
		expect(source).toMatch(/targetReleaseShaOverride/);
		expect(source).not.toMatch(/CELEBRA_TARGET_RELEASE_SHA/);
	});

	it('local migrate alias never injects --apply', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/apply-local-migrations.ts'),
			'utf8',
		);
		expect(source).not.toMatch(/injectLegacyApply/);
		expect(source).not.toMatch(/DEPRECATED: pnpm db:local:migrate defaults to --apply/);
		expect(source).toMatch(/--target',\s*'local'/);
	});

	it('registers preview_approval_artifacts expand migration', () => {
		const registry = JSON.parse(
			readFileSync(
				resolve(process.cwd(), 'supabase/migration-rollout-registry.json'),
				'utf8',
			),
		) as { migrations: Record<string, { phase: string; provides?: string[] }> };
		expect(registry.migrations['20260806120000']).toMatchObject({
			phase: 'expand',
			provides: expect.arrayContaining(['preview_approval_artifacts']),
		});
	});
});
