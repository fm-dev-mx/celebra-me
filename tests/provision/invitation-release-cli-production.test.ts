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

	it('guides next action Local → Preview → approve → Production', () => {
		const nextAction = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-next-action.ts'),
			'utf8',
		);
		expect(nextAction).toContain("action: 'local'");
		expect(nextAction).toContain("action: 'preview'");
		expect(nextAction).toContain("action: 'approve'");
		expect(nextAction).toContain("action: 'production'");
		const cli = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(cli).toContain('deriveInvitationReleaseNextAction');
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
