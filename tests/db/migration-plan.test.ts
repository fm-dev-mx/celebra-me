import { describe, expect, it } from '@jest/globals';
import {
	buildMigrationPlan,
	computePlanId,
	detectPlanDrift,
	planToJson,
	serializePlanIdentityForHash,
	type MigrationPlanIdentity,
} from '../../scripts/db/migration-plan.ts';

function sampleIdentity(overrides: Partial<MigrationPlanIdentity> = {}): MigrationPlanIdentity {
	return {
		target: 'preview',
		mode: 'preflight',
		sourceHead: 'abc1234def',
		redactedTargetIdentity: 'preview:postgresql://***@db.example.supabase.co:5432/postgres',
		pendingVersions: ['20260730220544'],
		expectedPin: null,
		phaseByVersion: { '20260730220544': 'expand' },
		compatibilityStatus: 'allow',
		compatibilityReasons: ['ok'],
		releaseIdentity: { kind: 'target_sha', value: 'abc1234def' },
		deployedAppIdentity: { sha: null, capabilities: [] },
		authRequirement: 'preview_scope_or_tty',
		backupRequirement: 'none',
		executor: 'supabase_cli_push',
		verificationRequirement: 'history_and_mutation_contract',
		releaseEvidenceSha: null,
		...overrides,
	};
}

describe('MigrationPlan', () => {
	it('computes a deterministic secret-free planId', () => {
		const a = computePlanId(sampleIdentity());
		const b = computePlanId(sampleIdentity());
		expect(a).toBe(b);
		expect(a).toMatch(/^[a-f0-9]{64}$/);
		const serialized = serializePlanIdentityForHash(sampleIdentity());
		// Redacted identity may keep a scheme host form, but must never include credentials.
		expect(serialized).not.toMatch(/postgresql:\/\/[^:"\s]+:[^@"\s]+@/i);
		expect(serialized).not.toMatch(/password|secret|token/i);
	});

	it('changes planId when pending versions change', () => {
		const base = computePlanId(sampleIdentity());
		const changed = computePlanId(sampleIdentity({ pendingVersions: ['20260730113000'] }));
		expect(changed).not.toBe(base);
	});

	it('keeps planId stable across preflight/apply mode and releaseEvidenceSha', () => {
		const preflight = computePlanId(sampleIdentity({ mode: 'preflight', releaseEvidenceSha: null }));
		const apply = computePlanId(
			sampleIdentity({ mode: 'apply', releaseEvidenceSha: 'abc1234def' }),
		);
		expect(apply).toBe(preflight);
	});

	it('detects plan drift fields before write', () => {
		const left = buildMigrationPlan(sampleIdentity());
		const right = buildMigrationPlan(sampleIdentity({ sourceHead: 'ffffffffffff' }));
		expect(detectPlanDrift(left, right)).toEqual(
			expect.arrayContaining(['sourceHead', 'planId']),
		);
	});

	it('planToJson stays secret-free and JSON-serializable', () => {
		const plan = buildMigrationPlan(sampleIdentity());
		const json = planToJson(plan);
		const encoded = JSON.stringify(json);
		expect(encoded).toContain(plan.planId);
		expect(encoded).not.toMatch(/postgresql:\/\/[^"]+:[^"@]+@/i);
		expect(json.pendingVersions).toEqual(['20260730220544']);
	});
});
