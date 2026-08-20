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
		expect(() => parseMutationTargets('production')).toThrow(/prod:apply/);
	});

	it('dispatches Production dry-run through runPromotionPreflight and hands apply to prod:apply', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(source).toContain('runPromotionPreflight');
		expect(source).toContain("targets[0] === 'production'");
		expect(source).toContain('runProductionReleaseDispatch');
		expect(source).toContain('USE_PROD_APPLY');
		expect(source).toContain('pnpm prod:apply');
		expect(source).not.toContain('orchestrateInvitationPromotion');
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

	it('does not tell operators to apply Production with invitation:release', () => {
		const cli = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		const promote = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-promote.ts'),
			'utf8',
		);
		const options = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-update-options.ts'),
			'utf8',
		);
		expect(cli).not.toMatch(/invitation:release[^\n]*--targets production --apply/);
		expect(promote).toContain('pnpm prod:apply -- --schema');
		expect(promote).not.toContain('rerun invitation:release --targets production');
		expect(options).toContain('pnpm prod:apply -- --slug');
		expect(options).not.toMatch(
			/Use pnpm invitation:release -- --slug <slug> --targets production for owner-only/,
		);
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
		expect(wizard).toContain('runPromotionPreflight');
		expect(wizard).toContain('pnpm prod:apply');
		expect(wizard).not.toContain('orchestrateInvitationPromotion');
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

	it('inherits definition deliveryScope instead of defaulting Local/Preview to content-only', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(source).toContain('parseCliUpdateScope');
		expect(source).toContain('requireResolvedUpdateScope');
		expect(source).toContain('defaultAssetPolicy');
		expect(source).not.toContain(
			"rawScope === 'content-and-assets' || rawScope === 'assets-only' ? rawScope : 'content-only'",
		);
		expect(source).not.toMatch(
			/raw === 'content-and-assets' \|\|[\s\S]*raw === 'content-only'[\s\S]*\? raw[\s\S]*: undefined/,
		);
	});

	it('re-resolves pruneAssets after deliveryScope resolves updateScope', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		const early = source.indexOf('let pruneAssets = resolveCliPruneAssets(args, parsedScope)');
		const resolved = source.indexOf('const updateScope = requireResolvedUpdateScope({');
		const reResolve = source.indexOf(
			'pruneAssets = resolveCliPruneAssets(args, updateScope)',
			resolved,
		);
		expect(early).toBeGreaterThan(-1);
		expect(resolved).toBeGreaterThan(early);
		expect(reResolve).toBeGreaterThan(resolved);
	});

	it('applies the confirmed Preview package and does not export after YES', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		const start = source.indexOf('async function executePreviewTargetPlan');
		const end = source.indexOf('function formatPreviewReceiptDiagnosis');
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		const applyFn = source.slice(start, end);
		expect(applyFn).toContain('requireConfirmedPreviewPackage');
		expect(applyFn).toContain('authorizePreviewWriteApply');
		expect(applyFn).not.toContain('exportInvitationPackage');
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
