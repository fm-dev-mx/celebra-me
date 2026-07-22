import { describe, expect, it } from '@jest/globals';
import { buildStatusReport, parseTargets } from '../../scripts/provision/invitation-update-options.ts';

describe('unified workflow dependency reporting', () => {
	it('maps all to the mandatory Local/Preview workflow and rejects invalid bypasses', () => {
		expect(parseTargets('all')).toEqual(['local', 'preview']);
		expect(() => parseTargets('local,production')).toThrow(/Preview approval is mandatory/i);
	});

	it('honors read-only status filters and does not pretend unqueried targets are present', () => {
		const report = buildStatusReport(['--status', '--slug', 'romina-rios-chaparro', '--targets', 'preview', '--include-legacy']) as { filters: { targets: string[]; includeLegacy: boolean }; definitions: Array<{ slug: string; environments: Record<string, { status: string }> }>; legacy: { status: string } };
		expect(report.filters).toMatchObject({ targets: ['preview'], includeLegacy: true });
		expect(report.definitions).toHaveLength(1);
		expect(report.definitions[0]).toMatchObject({ slug: 'romina-rios-chaparro', environments: { preview: { status: 'UNVERIFIED' } } });
		expect(report.legacy.status).toBe('UNVERIFIED');
	});
});
