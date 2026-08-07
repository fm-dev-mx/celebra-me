/**
 * Future-invitation protection: definition→Local/Preview content path never touches Production.
 * Complements intake creation unit tests; does not run hosted writes.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseReleaseMutationTargets } from '../../scripts/provision/invitation-update-options.ts';

describe('managed definition content path boundaries', () => {
	it('release targets keep Production exclusive from Local and Preview writes', () => {
		expect(parseReleaseMutationTargets('local,preview')).toEqual(['local', 'preview']);
		expect(parseReleaseMutationTargets('production')).toEqual(['production']);
		expect(() => parseReleaseMutationTargets('local,production')).toThrow(
			'PRODUCTION_TARGET_EXCLUSIVE',
		);
	});

	it('shared content apply module only exposes local|preview targets', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-content-apply.ts'),
			'utf8',
		);
		expect(source).toMatch(/export type ContentApplyTarget = 'local' \| 'preview'/);
		expect(source).not.toMatch(/ContentApplyTarget = .*"production"/);
		expect(source).toMatch(/Content apply never runs migrations/i);
	});
});
