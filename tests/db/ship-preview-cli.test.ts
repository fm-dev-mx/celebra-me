import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildMigrationPlan, type MigrationPlan } from '../../scripts/db/migration-plan.ts';
import { shipPreview, type ShipPreviewDeps } from '../../scripts/db/ship-preview-cli.ts';

function plan(pendingVersions: string[]): MigrationPlan {
	return buildMigrationPlan({
		target: 'local',
		mode: 'preflight',
		sourceHead: 'abc1234',
		redactedTargetIdentity: 'local:redacted',
		pendingVersions,
		expectedPin: null,
		phaseByVersion: Object.fromEntries(pendingVersions.map((v) => [v, 'expand'])),
		compatibilityStatus: 'allow',
		compatibilityReasons: ['ok'],
		releaseIdentity: { kind: 'target_sha', value: 'abc1234' },
		deployedAppIdentity: { sha: null, capabilities: [] },
		authRequirement: 'none',
		backupRequirement: 'none',
		executor: 'psql_atomic',
		verificationRequirement: 'history',
		releaseEvidenceSha: null,
	});
}

function deps(overrides: Partial<ShipPreviewDeps> = {}) {
	const order: string[] = [];
	const base: ShipPreviewDeps = {
		verifyAvailability: async () => {
			order.push('availability');
			return [
				{ environment: 'local', available: true },
				{ environment: 'preview', available: true },
			];
		},
		preflight: (target) => {
			order.push(`preflight:${target}`);
			return plan([]);
		},
		apply: async (target) => {
			order.push(`apply:${target}`);
			return { plan: plan(['20260101000000']), wrote: true };
		},
		audit: (target) => {
			order.push(`audit:${target}`);
		},
		summarize: () => {
			order.push('summary');
		},
	};
	return { order, deps: { ...base, ...overrides } };
}

describe('ship:preview', () => {
	beforeEach(() => {
		jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
	});
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('plans every target read-only without --apply', async () => {
		const { order, deps: d } = deps();
		const result = await shipPreview({ apply: false }, d);
		expect(order).toEqual([
			'availability',
			'preflight:disposable-test',
			'preflight:local',
			'preflight:preview',
		]);
		expect(result.applied).toBe(false);
	});

	it('stops planning after a pending disposable apply that Local and Preview depend on', async () => {
		const { order, deps: d } = deps({
			preflight: (target) => {
				order.push(`preflight:${target}`);
				return plan(target === 'disposable-test' ? ['20260101000000'] : []);
			},
		});
		await shipPreview({ apply: false }, d);
		expect(order).toEqual(['availability', 'preflight:disposable-test']);
	});

	it('applies in order and audits Local and Preview after each write', async () => {
		const { order, deps: d } = deps();
		await shipPreview({ apply: true }, d);
		expect(order).toEqual([
			'availability',
			'apply:disposable-test',
			'apply:local',
			'audit:local',
			'apply:preview',
			'audit:preview',
			'summary',
		]);
	});

	it('never touches Preview after a Local failure', async () => {
		const { order, deps: d } = deps({
			apply: async (target) => {
				order.push(`apply:${target}`);
				if (target === 'local') throw new Error('local apply failed');
				return { plan: plan([]), wrote: false };
			},
		});
		await expect(shipPreview({ apply: true }, d)).rejects.toThrow('local apply failed');
		expect(order).toEqual(['availability', 'apply:disposable-test', 'apply:local']);
	});

	it('fails closed before any step when a database is unavailable', async () => {
		const { order, deps: d } = deps({
			verifyAvailability: async () => [
				{ environment: 'local', available: true },
				{ environment: 'preview', available: false },
			],
		});
		await expect(shipPreview({ apply: true }, d)).rejects.toThrow(/preview/);
		expect(order).toEqual([]);
	});
});
