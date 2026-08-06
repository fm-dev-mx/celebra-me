/**
 * Future-invitation protection: definition→Local/Preview content path never touches Production.
 * Complements intake creation unit tests; does not run hosted writes.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DB_SYNC_DIRECTIONS } from '../../scripts/db/db-sync-types.ts';
import { gatesForDirection } from '../../scripts/db/db-sync-plan.ts';

describe('managed definition content path boundaries', () => {
	it('definition directions require CURRENT schema and never map to Production write env', () => {
		expect(DB_SYNC_DIRECTIONS).toEqual(
			expect.arrayContaining([
				'definition-to-local',
				'definition-to-preview',
				'package-to-production',
				'production-to-preview-mirror',
			]),
		);
		expect(gatesForDirection('definition-to-local').schemaCurrentRequired).toBe(true);
		expect(gatesForDirection('definition-to-preview').schemaCurrentRequired).toBe(true);
		expect(gatesForDirection('package-to-production').schemaCurrentRequired).toBe(true);
	});

	it('shared content apply module only exposes local|preview targets', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-content-apply.ts'),
			'utf8',
		);
		expect(source).toMatch(/export type ContentApplyTarget = 'local' \| 'preview'/);
		expect(source).not.toMatch(/ContentApplyTarget = .*"production"/);
		expect(source).toMatch(/never runs schema migrations/i);
	});
});
