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
} from '@/lib/status/semantics';
import { presentPromotionRow } from '@/lib/status/presentation';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

describe('status semantics', () => {
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
		const local = authorizationRemediation(buildCanonicalStatusViewFixture().environments.local);
		expect(local.semantic).toBe('neutral');
		expect(local.command).toBeNull();
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
		expect(remediation.command).toBeNull();
		expect(remediation.stepType).toBe('Manual/HITL');
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
		expect(queue.command).toBe('pnpm dbs');
		expect(queue.meaning).not.toMatch(/no hay invitaciones/i);
	});

	it('returns command null for aggregate invitation attention > 0 without fake remediation command', () => {
		const row = {
			...buildCanonicalStatusViewFixture().environments.preview,
			evidence: 'LIVE' as const,
			invitationAttentionCount: 2,
		};
		const remediation = invitationAttentionRemediation(row);
		expect(remediation.semantic).toBe('unverified');
		expect(remediation.command).toBeNull();
		expect(remediation.noCanonicalRemediation).toBe(true);
		expect(remediation.nextAction).toContain('cola de publicación');
		expect(remediation.stepType).toBe('Verify');
	});

	it('surfaces disposable proof as a confirmed gap with the existing migrate command', () => {
		const remediation = disposableRemediation({
			status: 'missing',
			reason: 'Missing disposable migration proof.',
			evidence: 'LIVE',
		});
		expect(remediation.semantic).toBe('blocked');
		expect(remediation.command).toBe('pnpm db:migrate -- --target disposable-test --apply');
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
		expect(schemaRemediation(behind).command).toBe('pnpm db:migrate -- --target local');
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
		expect(remediation.command).toBe('pnpm invitation:diagnose-identity -- --target local');

		const promote = publicationRemediation(buildCanonicalStatusViewFixture().promotions[0]!);
		expect(promote.semantic).toBe('unverified');
		expect(promote.requiresOwner).toBe(true);
		expect(promote.command).toContain('invitation:release');
	});
});
