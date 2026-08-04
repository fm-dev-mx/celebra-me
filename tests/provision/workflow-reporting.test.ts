import { describe, expect, it } from '@jest/globals';
import { buildStatusReport, parseTargets } from '../../scripts/provision/invitation-update-options.ts';

describe('unified workflow dependency reporting', () => {
	it('maps all and production to the coordinated Local/Preview/Production release pipeline', () => {
		expect(parseTargets('all')).toEqual(['local', 'preview', 'production']);
		expect(parseTargets('local,production')).toEqual(['local', 'preview', 'production']);
	});

	it('labels invitation:update --status as local inventory with unprobed remotes', () => {
		const report = buildStatusReport({
			slug: 'romina-rios-chaparro',
			targets: ['preview'],
			includeLegacy: true,
		}) as {
			surface: string;
			remoteProbe: string;
			filters: { targets: string[]; includeLegacy: boolean };
			definitions: Array<{
				slug: string;
				environments: Record<string, { status: string; probed?: boolean }>;
			}>;
			legacy: { status: string };
		};
		expect(report.surface).toBe('local_inventory');
		expect(report.remoteProbe).toBe('not_performed');
		expect(report.filters).toMatchObject({ targets: ['preview'], includeLegacy: true });
		expect(report.definitions).toHaveLength(1);
		expect(report.definitions[0]).toMatchObject({
			slug: 'romina-rios-chaparro',
			environments: { preview: { status: 'INVENTORY_UNVERIFIED', probed: false } },
		});
		expect(report.legacy.status).toBe('INVENTORY_UNVERIFIED');
	});
});
