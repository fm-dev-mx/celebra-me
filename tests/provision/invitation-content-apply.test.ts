import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	assertContentSchemaCurrent,
	contentMigrateCommandForTarget,
} from '../../scripts/provision/invitation-content-apply.ts';

describe('invitation-content-apply schema gate', () => {
	it('allows CURRENT and blocks BEHIND without auto-migrate', () => {
		expect(() =>
			assertContentSchemaCurrent({ target: 'local', schemaLifecycle: 'CURRENT' }),
		).not.toThrow();
		expect(() =>
			assertContentSchemaCurrent({ target: 'preview', schemaLifecycle: 'BEHIND' }),
		).toThrow(/SCHEMA_INCOMPATIBLE/);
		expect(contentMigrateCommandForTarget('preview')).toBe('pnpm db:preview:migrate');
		expect(contentMigrateCommandForTarget('local')).toBe('pnpm db:local:migrate');
	});

	it('db:sync and invitation:update both delegate to shared content apply', () => {
		const sync = readFileSync(
			resolve(process.cwd(), 'scripts/db/db-sync-orchestrator.ts'),
			'utf8',
		);
		const update = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-update-cli.ts'),
			'utf8',
		);
		expect(sync).toMatch(/planAndApplyLocalContent/);
		expect(sync).toMatch(/planAndApplyPreviewContent/);
		expect(sync).toMatch(/schemaCurrentRequired|schemaCurrentBlockers/);
		expect(update).toMatch(/planAndApplyLocalContent/);
		expect(update).toMatch(/planAndApplyPreviewContent/);
		expect(update).toMatch(/authorizePreviewWriteApply/);
		expect(update).toMatch(/finalize-approval/);
		expect(update).toMatch(/provenance-baseline/);
	});

	it('approvals migrate defaults to dry-run and requires Preview auth on apply', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/preview-approval-migrate.ts'),
			'utf8',
		);
		expect(source).toMatch(/const dryRun = !apply/);
		expect(source).toMatch(/authorizePreviewWriteApply/);
		expect(source).toMatch(/operation: 'migrate'/);
	});
});
