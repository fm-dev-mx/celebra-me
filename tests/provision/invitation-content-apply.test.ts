import { describe, expect, it } from '@jest/globals';
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
		expect(contentMigrateCommandForTarget('preview')).toBe('pnpm db:migrate -- --target preview');
		expect(contentMigrateCommandForTarget('local')).toBe('pnpm db:migrate -- --target local');
	});
});
