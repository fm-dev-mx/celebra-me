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

	it('preview migrate policy uses exact perimeter and clean-HEAD release identity', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/migrate-policy-preview.ts'),
			'utf8',
		);
		expect(source).toMatch(/assertPreviewDbUrl/);
		expect(source).toMatch(/assertCleanGitWorktree/);
		expect(source).toMatch(/targetReleaseShaOverride/);
		expect(source).not.toMatch(/CELEBRA_TARGET_RELEASE_SHA/);
	});

	it('local and preview migrate aliases invoke the canonical migrate CLI', () => {
		const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['db:local:migrate']).toBe(
			'tsx scripts/db/migrate-cli.ts --target local',
		);
		expect(pkg.scripts['db:preview:migrate']).toBe(
			'tsx scripts/db/migrate-cli.ts --target preview',
		);
		expect(pkg.scripts['db:prod:migrate']).toBe(
			'tsx scripts/db/migrate-cli.ts --target production',
		);
		expect(pkg.scripts['db:local:migrate']).not.toMatch(/apply-local-migrations/);
		expect(pkg.scripts['db:preview:migrate']).not.toMatch(/push-preview-migrations/);
	});
});
