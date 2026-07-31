import { describe, expect, it } from '@jest/globals';
import { classifySchemaLifecycle } from '../../scripts/db/schema-lifecycle-state.ts';

describe('classifySchemaLifecycle', () => {
	it('classifies verified aligned schema as CURRENT', () => {
		expect(classifySchemaLifecycle({ verified: true })).toBe('CURRENT');
	});

	it('classifies pending migrations as BEHIND', () => {
		expect(classifySchemaLifecycle({ pendingMigrations: ['20260731000100'] })).toBe('BEHIND');
	});

	it.each([
		{ extraMigrations: ['20260730000100'] },
		{ mismatchedMigrations: ['20260730000100'] },
		{ auditErrors: ['policy mismatch'] },
	])('classifies detected mismatch as SCHEMA_DRIFT', (input) => {
		expect(classifySchemaLifecycle(input)).toBe('SCHEMA_DRIFT');
	});

	it('classifies an unverified audit as UNVERIFIED', () => {
		expect(classifySchemaLifecycle({ verified: false, pendingMigrations: ['x'] })).toBe('UNVERIFIED');
	});
});
