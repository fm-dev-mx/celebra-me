/**
 * db-sync facade contract tests — parsing, directions, plans, redaction, JSON, ownership.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, jest } from '@jest/globals';

import {
	assertAllowedDirection,
	DB_SYNC_DIRECTIONS,
	DB_SYNC_SCHEMA_VERSION,
	emptyResult,
	exitCodeForResult,
	resultToJson,
} from '../../scripts/db/db-sync-types.ts';
import { parseDbSyncArgs } from '../../scripts/db/db-sync-args.ts';
import {
	assertExactPlan,
	assertPlanFresh,
	buildDbSyncPlan,
	computeMirrorDataFingerprint,
	gatesForDirection,
} from '../../scripts/db/db-sync-plan.ts';
import { CONTENT_MIRROR_TABLES, EXCLUDED_TABLES } from '../../scripts/db/db-target-config.ts';
import { redactProbeIo } from '../../scripts/status-core/probe-runner.ts';

describe('db-sync args and directions', () => {
	it('parses modes and directions', () => {
		const parsed = parseDbSyncArgs([
			'plan',
			'--direction',
			'definition-to-preview',
			'--slug',
			'daniela-y-martin',
			'--package',
			'pkg.json',
			'--json',
			'--no-interactive',
		]);
		expect(parsed.mode).toBe('plan');
		expect(parsed.direction).toBe('definition-to-preview');
		expect(parsed.slug).toBe('daniela-y-martin');
		expect(parsed.json).toBe(true);
		expect(parsed.noInteractive).toBe(true);
	});

	it('maps --target local/preview to update directions and rejects production target', () => {
		expect(parseDbSyncArgs(['plan', '--target', 'local']).direction).toBe(
			'definition-to-local',
		);
		expect(parseDbSyncArgs(['plan', '--target', 'preview']).direction).toBe(
			'definition-to-preview',
		);
		expect(() => parseDbSyncArgs(['plan', '--target', 'production'])).toThrow(
			/FORBIDDEN_DIRECTION/,
		);
	});

	it('rejects forbidden directions', () => {
		expect(() => assertAllowedDirection('preview-to-production')).toThrow(
			/FORBIDDEN_DIRECTION/,
		);
		expect(() => assertAllowedDirection('production-to-local')).toThrow(/FORBIDDEN_DIRECTION/);
		expect(() => assertAllowedDirection('local-to-production')).toThrow(/FORBIDDEN_DIRECTION/);
		for (const direction of DB_SYNC_DIRECTIONS) {
			expect(assertAllowedDirection(direction)).toBe(direction);
		}
	});
});

describe('db-sync plan identity', () => {
	it('builds stable mirror plan ids from allowlists and identities', () => {
		const fingerprint = computeMirrorDataFingerprint({
			sourceProjectRef: 'prod',
			targetProjectRef: 'preview',
			semanticDigest: 'abc',
		});
		const a = buildDbSyncPlan({
			direction: 'production-to-preview-mirror',
			slug: null,
			redactedSourceIdentity: 'production:redacted',
			redactedTargetIdentity: 'preview:redacted',
			dataFingerprint: fingerprint,
			schemaEvidence: 'preview:CURRENT,production:CURRENT',
			now: new Date('2026-08-04T00:00:00.000Z'),
		});
		const b = buildDbSyncPlan({
			direction: 'production-to-preview-mirror',
			slug: null,
			redactedSourceIdentity: 'production:redacted',
			redactedTargetIdentity: 'preview:redacted',
			dataFingerprint: fingerprint,
			schemaEvidence: 'preview:CURRENT,production:CURRENT',
			now: new Date('2026-08-04T00:00:00.000Z'),
		});
		expect(a.planId).toBe(b.planId);
		expect(a.gates.rsvpResetDisclosureRequired).toBe(true);
		expect(a.delegatedEngine).toBe('runPreviewMirror');
		expect(fingerprint).toMatch(/^[a-f0-9]{32}$/);
	});

	it('detects plan drift and expiration', () => {
		const plan = buildDbSyncPlan({
			direction: 'definition-to-local',
			slug: 'demo',
			packageHash: 'pkg',
			sourceHash: 'src',
			redactedSourceIdentity: 'package:pkg',
			redactedTargetIdentity: 'local:redacted',
			dataFingerprint: 'data',
			assetFingerprint: 'assets',
			schemaEvidence: 'local:CURRENT',
			now: new Date('2026-08-04T00:00:00.000Z'),
		});
		expect(() => assertExactPlan(plan, 'other')).toThrow(/PLAN_DRIFT/);
		expect(() => assertExactPlan(plan, plan.planId)).not.toThrow();
		expect(() => assertPlanFresh(plan, new Date('2026-08-04T01:00:00.000Z'))).toThrow(
			/PLAN_EXPIRED/,
		);
		expect(gatesForDirection('package-to-production').ownerProductionApplyRequired).toBe(true);
	});
});

describe('db-sync JSON and exit codes', () => {
	it('emits versioned secret-free JSON and fails closed on apply/diagnose errors', () => {
		const result = emptyResult('diagnose');
		result.ok = false;
		result.status = 'BLOCKED';
		result.failures.push('preview: CREDENTIALS_REQUIRED');
		result.targets.push({
			environment: 'preview',
			available: false,
			reason: 'CREDENTIALS_REQUIRED',
			redactedIdentity: 'preview:postgresql://user:<redacted>@host:5432/postgres',
		});
		const json = resultToJson(result);
		expect(json).toContain(DB_SYNC_SCHEMA_VERSION);
		expect(json).toContain('"command": "db:sync"');
		expect(json).not.toContain('super-secret');
		expect(json).not.toMatch(/:[^:/<"\s]{8,}@/);
		expect(exitCodeForResult(result, { strict: true })).toBe(1);

		const applyOk = emptyResult('apply');
		applyOk.ok = true;
		applyOk.status = 'applied';
		expect(exitCodeForResult(applyOk)).toBe(0);
		applyOk.ok = false;
		expect(exitCodeForResult(applyOk)).toBe(1);
	});
});

describe('db-sync ownership / no second engines', () => {
	it('reuses CONTENT_MIRROR_TABLES and EXCLUDED_TABLES rather than local copies', () => {
		const source = readFileSync('scripts/db/db-sync-orchestrator.ts', 'utf8');
		expect(source).toMatch(/CONTENT_MIRROR_TABLES/);
		expect(source).toMatch(/EXCLUDED_TABLES/);
		expect(source).toMatch(/runPreviewMirror/);
		expect(source).toMatch(/runPromotionPreflight/);
		expect(source).toMatch(/requireOwnerProductionApply/);
		expect(source).not.toMatch(/truncate table public\.events cascade/i);
		expect(source).not.toMatch(/storage\/v1\/object/);
		expect(CONTENT_MIRROR_TABLES).toContain('invitations');
		expect(EXCLUDED_TABLES).toContain('guest_invitations');
	});
});

describe('async probe redaction helper', () => {
	it('redacts raw database URLs without truncating payloads', () => {
		const url = 'postgresql://postgres:super-secret@db.example.supabase.co:5432/postgres';
		const redacted = redactProbeIo(`error connecting ${url} trailing-data-${'x'.repeat(400)}`, [
			url,
		]);
		expect(redacted).not.toContain('super-secret');
		expect(redacted).toContain('<redacted>');
		expect(redacted.length).toBeGreaterThan(280);
	});
});

describe('upsert failure surface', () => {
	it('returns failed rows from upsertFromJson', async () => {
		jest.resetModules();
		let call = 0;
		jest.doMock('../../scripts/db/db-workflow-lib.ts', () => ({
			runPsql: () => {
				call += 1;
				if (call === 1) {
					return { status: 0, stdout: 'id\nslug\n', stderr: '' };
				}
				return { status: 1, stdout: '', stderr: 'duplicate key' };
			},
			sqlLiteral: (v: string) => `'${v}'`,
			quoteIdentifier: (v: string) => `"${v}"`,
		}));
		const { upsertFromJson } = await import('../../scripts/db/preview-sync-db.ts');
		const result = upsertFromJson(
			'postgresql://local',
			'invitations',
			[{ id: '1', slug: 'a' }],
			'id',
		);
		expect(result.created).toBe(0);
		expect(result.failed).toBe(1);
		expect(result.failures[0]?.message).toMatch(/duplicate key/);
	});
});

describe('mirror plan fingerprint determinism', () => {
	it('changes when semantic digest changes', () => {
		const a = computeMirrorDataFingerprint({
			sourceProjectRef: 'a',
			targetProjectRef: 'b',
			semanticDigest: 'one',
		});
		const b = computeMirrorDataFingerprint({
			sourceProjectRef: 'a',
			targetProjectRef: 'b',
			semanticDigest: 'two',
		});
		expect(a).not.toBe(b);
	});
});
