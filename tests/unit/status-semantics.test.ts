/**
 * Presentation semantics must follow classified tokens — no parallel rules.
 */
import { describe, expect, it } from '@jest/globals';
import {
	authorizationRemediation,
	authorizationSemantic,
	disposableRemediation,
	invitationAttentionRemediation,
	publicationQueueRemediation,
	publicationRemediation,
	readinessSemantic,
	schemaLifecycleSemantic,
	schemaRemediation,
	diagnosticRemediation,
} from '@/lib/status/semantics';
import { DIAGNOSTIC_LABELS } from '@/lib/status/labels';
import type { CanonicalDiagnostic, DiagnosticCode } from '@/lib/status/types';
import { presentPromotionRow } from '@/lib/status/presentation';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

const commandOf = (remediation: { steps: { command: string | null }[] }) =>
	remediation.steps.find((step) => step.command)?.command ?? null;
const typeOf = (remediation: { steps: { type: string }[] }) => remediation.steps[0]?.type ?? null;

describe('status semantics', () => {
	it('has a presentable, non-authoritative remediation for every canonical diagnostic code', () => {
		for (const code of Object.keys(DIAGNOSTIC_LABELS) as DiagnosticCode[]) {
			const diagnostic: CanonicalDiagnostic = {
				code,
				domain:
					code === 'ENVIRONMENT_IDENTITY_CONFLICT' ||
					code === 'PRODUCTION_AUTHORIZATION_MISSING'
						? 'schema'
						: 'content',
				evidence: 'LIVE',
				environment: code === 'LIFECYCLE_METADATA_STALE' ? undefined : 'preview',
				slug:
					code === 'ENVIRONMENT_IDENTITY_CONFLICT' ||
					code === 'AUTHORITATIVE_COUNT_MISMATCH' ||
					code === 'PRODUCTION_AUTHORIZATION_MISSING'
						? undefined
						: 'demo',
				cause: 'Diagnostic test fixture.',
				affectedFieldCount: 0,
				affectedSectionCount: 0,
				semanticPaths: [],
			};
			const remediation = diagnosticRemediation(diagnostic);
			expect(DIAGNOSTIC_LABELS[code]).not.toEqual('');
			expect(remediation.meaning).toBe(DIAGNOSTIC_LABELS[code]);
			expect(remediation.nextAction).not.toEqual('');
		}
	});

	it('does not treat UNVERIFIED schema as CURRENT green', () => {
		expect(schemaLifecycleSemantic('CURRENT', 'LIVE')).toBe('verified');
		expect(schemaLifecycleSemantic('CURRENT', 'CACHED')).toBe('verified');
		expect(schemaLifecycleSemantic('CURRENT', 'UNVERIFIED')).toBe('unverified');
		expect(schemaLifecycleSemantic('UNVERIFIED', 'LIVE')).toBe('unverified');
		expect(schemaLifecycleSemantic('BEHIND', 'LIVE')).toBe('blocked');
		expect(schemaLifecycleSemantic('SCHEMA_DRIFT', 'LIVE')).toBe('blocked');
	});

	it('keeps No aplica authorization neutral and not a failure', () => {
		expect(authorizationSemantic('NOT_APPLICABLE')).toBe('neutral');
		expect(authorizationSemantic('RECORDED')).toBe('verified');
		expect(authorizationSemantic('GRANDFATHERED')).toBe('verified');
		expect(authorizationSemantic('MISSING')).toBe('blocked');
		expect(authorizationSemantic('UNVERIFIED')).toBe('unverified');
		const local = authorizationRemediation(
			buildCanonicalStatusViewFixture().environments.local,
		);
		expect(local.semantic).toBe('neutral');
		expect(commandOf(local)).toBeNull();
		expect(local.nextAction).toContain('No se requiere');
	});

	it('does not invent a backfill command for missing Production authorization', () => {
		const production = {
			...buildCanonicalStatusViewFixture().environments.production,
			authorizationIntegrity: 'MISSING' as const,
			authorizationMissingVersions: ['20260807120000'],
		};
		const remediation = authorizationRemediation(production);
		expect(remediation.semantic).toBe('blocked');
		expect(remediation.noCanonicalRemediation).toBe(true);
		expect(
			remediation.steps.filter((step) => !step.optional).find((step) => step.command)
				?.command ?? null,
		).toBeNull();
		expect(typeOf(remediation)).toBe('Manual/HITL');
	});

	it('does not treat an unverified empty publication queue as in-sync', () => {
		const view = buildCanonicalStatusViewFixture({
			promotions: [],
			inSyncCount: 0,
			inSyncSlugs: [],
			environments: {
				local: {
					...buildCanonicalStatusViewFixture().environments.local,
					evidence: 'UNVERIFIED',
					invitationAttentionCount: 0,
				},
				preview: {
					...buildCanonicalStatusViewFixture().environments.preview,
					evidence: 'UNVERIFIED',
					invitationAttentionCount: 0,
				},
				production: {
					...buildCanonicalStatusViewFixture().environments.production,
					evidence: 'UNVERIFIED',
					invitationAttentionCount: 0,
				},
			},
		});
		const queue = publicationQueueRemediation(view);
		expect(queue.semantic).toBe('unverified');
		expect(commandOf(queue)).toBe('pnpm dbs');
		expect(queue.meaning).not.toMatch(/no hay invitaciones/i);
	});

	it('returns command null for aggregate invitation attention > 0 without fake remediation command', () => {
		const row = {
			...buildCanonicalStatusViewFixture().environments.preview,
			evidence: 'LIVE' as const,
			invitationAttentionCount: 2,
		};
		const remediation = invitationAttentionRemediation(row);
		expect(remediation.semantic).toBe('neutral');
		expect(
			remediation.steps.filter((step) => !step.optional).find((step) => step.command)
				?.command ?? null,
		).toBeNull();
		expect(remediation.noCanonicalRemediation).toBe(true);
		expect(remediation.nextAction).toContain('cola de publicación');
		expect(remediation.steps).toHaveLength(1);
	});

	it('surfaces disposable proof as a confirmed gap with the existing migrate command', () => {
		const remediation = disposableRemediation({
			status: 'missing',
			reason: 'Missing disposable migration proof.',
			evidence: 'LIVE',
		});
		expect(remediation.semantic).toBe('blocked');
		expect(commandOf(remediation)).toBe('pnpm db:migrate -- --target disposable-test --apply');
	});

	it('uses schemaNextAction from readiness instead of inventing a migrate path', () => {
		const behind = {
			...buildCanonicalStatusViewFixture().environments.local,
			schemaLifecycle: 'BEHIND' as const,
			schemaOperationReadiness: 'PENDING_MIGRATIONS' as const,
			schemaNextAction: 'pnpm db:migrate -- --target local',
			pendingMigrations: ['20260807120000'],
			evidence: 'LIVE' as const,
		};
		expect(commandOf(schemaRemediation(behind))).toBe('pnpm db:migrate -- --target local');
		expect(readinessSemantic('UNVERIFIED')).toBe('unverified');
		expect(readinessSemantic('PENDING_MIGRATIONS')).toBe('blocked');
	});

	it('keeps BLOCKED publication distinct from PROMOTE and uses existing diagnostic commands', () => {
		const blocked = presentPromotionRow({
			slug: 'victoria-y-roberto',
			title: 'Victoria',
			eventType: 'boda',
			action: 'BLOCKED',
			reasonCode: 'IDENTITY_CONFLICT',
			environments: { local: 'conflict', preview: 'match', production: 'match' },
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
		});
		expect(blocked.handoff.dryRunCommand).toBe(
			'pnpm invitation:diagnose-identity -- --target local',
		);
		expect(blocked.handoff.applyCommand).toBeNull();
		const remediation = publicationRemediation(blocked);
		expect(remediation.semantic).toBe('blocked');
		expect(commandOf(remediation)).toBe('pnpm invitation:diagnose-identity -- --target local');

		const approvalRequired = presentPromotionRow({
			slug: 'abril-michelle-becerra-rea',
			title: 'Abril',
			eventType: 'boda',
			action: 'BLOCKED',
			reasonCode: 'PREVIEW_APPROVAL_REQUIRED',
			environments: { local: 'match', preview: 'match', production: 'behind' },
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
		});
		const approvalRemediation = publicationRemediation(approvalRequired);
		expect(commandOf(approvalRemediation)).toBe(
			'pnpm invitation:release -- --preview-provenance --slug abril-michelle-becerra-rea --targets preview --dry-run',
		);
		expect(approvalRequired.handoff.applyCommand).toBeNull();
		expect(approvalRemediation.steps[0]?.type).toBe('Verify');
		expect(JSON.stringify(approvalRemediation)).not.toContain('--targets preview --apply');

		const promote = publicationRemediation(buildCanonicalStatusViewFixture().promotions[0]!);
		expect(promote.semantic).toBe('unverified');
		expect(promote.steps.some((step) => step.requiresOwner)).toBe(true);
		expect(commandOf(promote)).toContain('prod:apply');
		expect(promote.steps).toHaveLength(1);
		expect(promote.steps[0]?.type).toBe('Apply');
	});

	it('does not recommend availability verify when UNKNOWN has live environment evidence', () => {
		const row = presentPromotionRow({
			slug: 'demo',
			title: 'Demo',
			eventType: 'boda',
			action: 'UNKNOWN',
			reasonCode: 'EVIDENCE_INCOMPLETE',
			environments: { local: 'unknown', preview: 'match', production: 'match' },
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
		});
		row.uncertaintyNotes.push('ASSET_IDENTITY_UNVERIFIED');
		const remediation = publicationRemediation(row);
		expect(
			remediation.steps.filter((step) => !step.optional).find((step) => step.command)
				?.command ?? null,
		).toBeNull();
		expect(remediation.noCanonicalRemediation).toBe(true);
		expect(remediation.steps.find((step) => step.optional)?.command).toBe(
			'pnpm dbs --diagnostics',
		);
		expect(JSON.stringify(remediation)).not.toContain('db:availability:verify');
	});

	it('keeps aggregate publication counts informational without Verify/Diagnose/Apply', () => {
		const queue = publicationQueueRemediation(buildCanonicalStatusViewFixture());
		expect(queue.steps).toHaveLength(1);
		expect(commandOf(queue)).toBeNull();
	});
});
