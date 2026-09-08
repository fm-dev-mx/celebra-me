import { describe, expect, it } from '@jest/globals';
import {
	formatCanonicalStatusView,
	formatSlugStatusView,
} from '../../scripts/provision/canonical-status-format';
import {
	groupPublicationRows,
	publicationStatusLabel,
} from '../../scripts/provision/canonical-status-summary';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture';
import type { CanonicalPromotionRow } from '../../src/lib/status/types';

const backup = {
	newestManifestPath: null,
	newestCreatedAt: null,
	newestAgeMs: null,
	lastDailyReportAt: null,
	lastDailyOutcome: null,
	orphanCount: 0,
	attention: true,
	summary: 'daily vencido',
};
const options = { env: { NO_COLOR: '1' }, backupHealth: backup };
function promotion(overrides: Partial<CanonicalPromotionRow> = {}): CanonicalPromotionRow {
	return { ...buildCanonicalStatusViewFixture().promotions[0], ...overrides };
}

describe('canonical status summary', () => {
	it('summarizes ten schema dependents and seven pending invitations within one screen', () => {
		const view = buildCanonicalStatusViewFixture({ manualPatches: [] });
		view.environments.production.schemaLifecycle = 'BEHIND';
		view.environments.production.pendingMigrations = ['pending'];
		view.environments.production.authorizationIntegrity = 'MISSING';
		view.promotions = [
			...Array.from({ length: 10 }, (_, i) =>
				promotion({
					slug: `blocked-${i}`,
					action: 'BLOCKED',
					reasonCode: 'PRODUCTION_PREFLIGHT_BLOCKED',
					preflightBlockCode: 'SCHEMA_INCOMPATIBLE',
				}),
			),
			...Array.from({ length: 7 }, (_, i) =>
				promotion({
					slug: `pending-${i}`,
					action: 'PROMOTE_PREVIEW',
					reasonCode: 'PREVIEW_BEHIND_CANONICAL',
					destination: 'preview',
					source: 'canonical',
				}),
			),
		];
		const original = JSON.stringify(view);
		const text = formatCanonicalStatusView(view, options);
		expect(text).toContain('bloquea 10 invitaciones');
		expect(text).toContain('7 invitaciones · Pendiente de sincronizar');
		expect(text).toContain('Respaldo de Producción');
		expect(text).toContain('faltan registros locales');
		expect(text).not.toContain('--apply');
		expect(text).not.toContain('Sin verificar');
		expect(text.trimEnd().split('\n').length).toBeLessThanOrEqual(30);
		expect(text.split('\n').every((line) => line.length <= 100)).toBe(true);
		expect(JSON.stringify(view)).toBe(original);
		const verbose = formatCanonicalStatusView(view, { ...options, verbose: true });
		for (const row of view.promotions) expect(verbose).toContain(row.slug);
	});

	it('retains unrelated blocks, incomplete evidence and different preflight causes', () => {
		const rows = [
			promotion({ action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' }),
			promotion({
				slug: 'blocked-a',
				action: 'BLOCKED',
				reasonCode: 'PRODUCTION_PREFLIGHT_BLOCKED',
				preflightBlockCode: 'A',
			}),
			promotion({
				slug: 'blocked-b',
				action: 'BLOCKED',
				reasonCode: 'PRODUCTION_PREFLIGHT_BLOCKED',
				preflightBlockCode: 'B',
			}),
		];
		expect(groupPublicationRows(rows)).toHaveLength(3);
		const text = formatCanonicalStatusView(
			buildCanonicalStatusViewFixture({ promotions: rows, manualPatches: [] }),
			options,
		);
		expect(text).toContain('Sin verificar');
		expect(text).toContain('(A)');
		expect(text).toContain('(B)');
	});

	it('keeps excluded environments out of the summary and does not mistake pending work for unknown', () => {
		const row = promotion({
			action: 'PROMOTE_PREVIEW',
			destination: 'preview',
			source: 'canonical',
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'UNVERIFIED' },
		});
		const view = buildCanonicalStatusViewFixture({
			selectedTargets: ['local', 'preview'],
			promotions: [row],
			manualPatches: [],
		});
		const text = formatCanonicalStatusView(view, options);
		expect(text).toContain('No evaluados: production');
		expect(text).not.toContain('Respaldo');
		expect(text).toContain('Pendiente de sincronizar');
		expect(
			publicationStatusLabel({
				...row,
				envEvidence: { ...row.envEvidence, preview: 'UNVERIFIED' },
			}),
		).toBe('Sin verificar');
	});

	it('retains detailed slug inspection and explicit diagnostic enrichment', () => {
		const view = buildCanonicalStatusViewFixture({
			manualPatches: [],
			diagnostics: [
				{
					code: 'MANAGED_DRIFT',
					domain: 'content',
					evidence: 'LIVE',
					cause: 'MANAGED_DRIFT',
					affectedFieldCount: 1,
					affectedSectionCount: 1,
					semanticPaths: ['hero.title'],
				},
			],
		});
		expect(
			formatSlugStatusView(view, view.promotions[0].slug, {
				verbose: true,
				env: options.env,
			}),
		).toContain('Reason:');
		const detail = formatSlugStatusView(view, view.promotions[0].slug, { env: options.env });
		expect(detail).toContain('--dry-run');
		expect(detail.indexOf('--dry-run')).toBeLessThan(detail.indexOf('--apply'));
		expect(formatCanonicalStatusView(view, options)).not.toContain('MANAGED_DRIFT');
		expect(formatCanonicalStatusView(view, { ...options, diagnostics: true })).toContain(
			'MANAGED_DRIFT',
		);
	});
});
