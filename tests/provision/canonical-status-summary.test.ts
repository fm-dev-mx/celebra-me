import { presentPromotionRow } from '../../src/lib/status/presentation';
import { describe, expect, it } from '@jest/globals';
import {
	formatCanonicalStatusView,
	formatSlugStatusView,
} from '../../scripts/provision/canonical-status-format';
import { publicationStatusLabel } from '../../scripts/provision/canonical-status-summary';
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
	return presentPromotionRow({
		...buildCanonicalStatusViewFixture().promotions[0],
		...overrides,
	});
}

describe('canonical status summary', () => {
	it('labels the aggregate column as actionable attention rather than pending publications', () => {
		const text = formatCanonicalStatusView(
			buildCanonicalStatusViewFixture({ manualPatches: [] }),
			options,
		);
		expect(text).toContain('Atención');
		expect(text).toContain('requieren atención');
		expect(text).not.toContain('Esquema                   Publicaciones');
	});

	it('summarizes ten schema dependents and seven pending invitations within one screen', () => {
		const view = buildCanonicalStatusViewFixture({ manualPatches: [] });
		view.environments.production.schemaLifecycle = 'BEHIND';
		view.environments.production.schemaNextAction = 'pnpm db:migrate -- --target production';
		view.disposableProof = { status: 'valid', evidence: 'LIVE', reason: 'Current proof' };
		view.environments.production.pendingMigrations = ['pending'];
		view.environments.production.migrationDeployment = {
			required: 'YES',
			status: 'UNVERIFIED',
			phases: ['contract'],
			requiredAppCapabilities: ['current-client'],
			observedAppSha: null,
			observedAppCapabilities: [],
			reason: 'Contract migration requires deployed client.',
		};
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
		expect(text).toContain('Publicación · Boda de Victoria y Roberto');
		expect(text).toContain('Respaldo de Producción');
		expect(text).toContain('faltan registros locales');
		expect(text).toContain('pnpm prod:apply -- --schema --expected pending --apply');
		expect(text).toContain('DESPLIEGUES');
		expect(text).toContain('pnpm ops:release-checks 0123456789abcdef0123456789abcdef01234567');
		expect(text).toContain(
			'pnpm invitation:release -- --slug pending-0 --targets preview --apply',
		);
		expect(text).toContain('pnpm db:prod:backup:daily');
		expect(text).toContain('OWNER / TTY / HITL');
		expect(text).toContain('Evidencia del despliegue: UNVERIFIED');
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
		const text = formatCanonicalStatusView(
			buildCanonicalStatusViewFixture({ promotions: rows, manualPatches: [] }),
			options,
		);
		expect(text).toContain('Sin verificar');
		expect(text).toContain('--slug blocked-a');
		expect(text).toContain('--slug blocked-b');
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
		expect(text).toContain('--targets preview --apply');
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

describe('actionable operator commands', () => {
	it('never offers apply for blocked or unknown publication decisions', () => {
		const view = buildCanonicalStatusViewFixture({
			manualPatches: [],
			promotions: [
				promotion({ action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' }),
				promotion({ slug: 'blocked', action: 'BLOCKED', reasonCode: 'MANAGED_DIVERGENCE' }),
			],
		});
		const text = formatCanonicalStatusView(view, {
			...options,
			backupHealth: { ...backup, attention: false },
		});
		expect(text).not.toContain('--apply');
		expect(text).toContain('Sin verificar');
		expect(text).toContain('Requiere corrección');
	});

	it('treats an isolated backup warning as an actionable item, not an all-clear', () => {
		const view = buildCanonicalStatusViewFixture({ promotions: [], manualPatches: [] });
		const text = formatCanonicalStatusView(view, options);
		expect(text).toContain('1 operaciones requieren atención');
		expect(text).toContain('1. PREPARACIÓN');
		expect(text).toContain('• Respaldo de Producción');
		expect(text).toContain('pnpm db:prod:backup:daily');
		expect(text).not.toContain('Sin acciones pendientes');
	});

	it('keeps canonical commands on one line for redirected output', () => {
		const slug = 'long-invitation-'.repeat(8);
		const view = buildCanonicalStatusViewFixture({
			promotions: [promotion({ slug })],
			manualPatches: [],
		});
		const text = formatCanonicalStatusView(view, options);
		expect(text.split('\n')).toContain(`     pnpm prod:apply -- --slug ${slug} --apply`);
	});

	it('renders preview approval dry-run and the exact hash-bound HITL command', () => {
		const hash = '3c0a950f373076b76ff40336b7d65f508f9d65c380508fcab92e763586390a1b';
		const approval = promotion({
			action: 'BLOCKED',
			reasonCode: 'PREVIEW_APPROVAL_REQUIRED',
		});
		approval.handoff = {
			dryRunCommand:
				'pnpm invitation:release -- --slug victoria-y-roberto --targets preview --dry-run',
			dryRunStepType: 'Verify',
			applyCommand: `pnpm invitation:release -- --package-hash ${hash} --approve`,
			applyStepType: 'Manual/HITL',
			ownerApplyRequired: false,
			optionalDiagnosticCommand: null,
			steps: [],
		};
		const view = buildCanonicalStatusViewFixture({
			manualPatches: [],
			promotions: [approval],
		});
		const text = formatCanonicalStatusView(view, {
			...options,
			backupHealth: { ...backup, attention: false },
		});
		expect(text).toContain('--targets preview --dry-run');
		expect(text).toContain(`--package-hash ${hash} --approve`);
		expect(text).toContain('Aprobar Preview [HITL]');
		expect(text).toContain('Requisito: TTY; Cancelar es el valor seguro.');
		expect(text).toContain('Despliegue previo: UNVERIFIED');
		expect(text).not.toContain('prod:apply -- --slug');
	});

	it('renders copy-safe PowerShell continuations and action prerequisites', () => {
		const view = buildCanonicalStatusViewFixture({ promotions: [] });
		const text = formatCanonicalStatusView(view, {
			...options,
			columns: 120,
			platform: 'win32',
			isTTY: true,
		});
		expect(text).toContain('pnpm db:prod:patch -- --dry-run --file `');
		expect(text).toContain('pnpm prod:apply -- --patch `');
		expect(text).toContain('Aplicar parche [OWNER / TTY / HITL]');
		expect(text).toContain('Requisito: TTY del propietario; Cancelar es el valor seguro.');
		expect(text).toContain('1. PREPARACIÓN');
		expect(text).toContain('2. DATOS');
		expect(text).not.toMatch(/^\d+\. Parche/m);
	});

	it('colors complete commands bright cyan only when terminal color is enabled', () => {
		const view = buildCanonicalStatusViewFixture({ promotions: [], manualPatches: [] });
		const colored = formatCanonicalStatusView(view, {
			...options,
			env: { FORCE_COLOR: '1' },
		});
		expect(colored).toContain('\x1b[1m\x1b[36mpnpm db:prod:backup:daily\x1b[0m');
		expect(formatCanonicalStatusView(view, options)).not.toContain('\x1b[');
	});

	it('does not request another deployment when compatibility evidence is satisfied', () => {
		const view = buildCanonicalStatusViewFixture({ manualPatches: [], promotions: [] });
		view.environments.preview.schemaLifecycle = 'BEHIND';
		view.environments.preview.schemaNextAction = 'pnpm db:migrate -- --target preview';
		view.environments.preview.pendingMigrations = ['20260806120000'];
		view.environments.preview.migrationDeployment = {
			required: 'YES',
			status: 'SATISFIED',
			phases: ['contract'],
			requiredAppCapabilities: ['current-client'],
			observedAppSha: '0123456789abcdef0123456789abcdef01234567',
			observedAppCapabilities: ['current-client'],
			reason: 'El preflight verificó las capacidades desplegadas.',
		};
		const text = formatCanonicalStatusView(view, {
			...options,
			backupHealth: { ...backup, attention: false },
		});
		expect(text).not.toContain('Código · Preview');
		expect(text).toContain('Evidencia del despliegue: SATISFIED');
	});
});
