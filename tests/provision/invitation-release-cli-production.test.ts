/**
 * invitation:release Production dispatch wiring (source + package script contracts).
 * Heavy CLI import chains are avoided; behavioral promote gates live in invitation-promote.test.ts.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toPublicPromotionReport } from '../../scripts/provision/invitation-promotion-format.ts';
import {
	parseMutationTargets,
	parseReleaseMutationTargets,
} from '../../scripts/provision/invitation-update-options.ts';

describe('invitation:release Production dispatch', () => {
	it('allows Production alone via parseReleaseMutationTargets and rejects mixes', () => {
		expect(parseReleaseMutationTargets('production')).toEqual(['production']);
		expect(() => parseReleaseMutationTargets('local,production')).toThrow(
			/PRODUCTION_TARGET_EXCLUSIVE/,
		);
		expect(() => parseMutationTargets('production')).toThrow(/invitation:release/);
	});

	it('dispatches Production through orchestrateInvitationPromotion / runPromotionPreflight', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(source).toContain('orchestrateInvitationPromotion');
		expect(source).toContain('runPromotionPreflight');
		expect(source).toContain("targets[0] === 'production'");
		expect(source).toContain('runProductionReleaseDispatch');
		expect(source).not.toContain('requireOwnerProductionApply');
		expect(source).not.toMatch(/runPromotionApply\s*\(/);
	});

	it('points schema incompatibility at pnpm db:migrate', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(source).toContain('pnpm db:migrate');
		expect(source).toMatch(/nunca migra/i);
	});

	it('TTY modeCount===0 delegates to destination wizard (not next-action chain)', () => {
		const cli = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(cli).toContain('runDestinationReleaseWizard');
		expect(cli).toContain('Ignore leftover --targets');
		expect(cli).not.toContain('deriveInvitationReleaseNextAction');
		const wizard = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-wizard.ts'),
			'utf8',
		);
		expect(wizard).toContain("describeDestination('local')");
		expect(wizard).toContain("describeDestination('prepare_preview')");
		expect(wizard).toContain("describeDestination('production')");
		expect(wizard).toContain('expectedSourceHash');
		expect(wizard).toContain('expectedPackageHash');
		expect(wizard).toContain('orchestrateInvitationPromotion');
		expect(wizard).not.toContain('reviewedPreflight');
	});

	it('strips targetDbUrl from public JSON reports', () => {
		const publicReport = toPublicPromotionReport({
			status: 'PROMOTED',
			slug: 'demo',
			targetDbUrl: 'postgresql://secret@db.example/postgres',
		} as never);
		expect(publicReport).not.toHaveProperty('targetDbUrl');
		expect(JSON.stringify(publicReport)).not.toContain('secret');
	});

	it('registers invitation:release as the public package script', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['invitation:release']).toContain('invitation-release-cli.ts');
		expect(pkg.scripts['invitation:update']).toBeUndefined();
		expect(pkg.scripts['invitation:promote']).toBeUndefined();
		expect(pkg.scripts['invitation:approvals:migrate']).toBeUndefined();
		expect(pkg.scripts['db:sync']).toBeUndefined();
	});
});
