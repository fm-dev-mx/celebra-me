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

	it('infers apply mode from --apply and rejects unknown flags / missing values', () => {
		expect(parseDbSyncArgs(['--apply', '--direction', 'definition-to-local']).mode).toBe(
			'apply',
		);
		expect(() => parseDbSyncArgs(['diagnose', '--bogus'])).toThrow(/Unknown argument/);
		expect(() => parseDbSyncArgs(['--mode'])).toThrow(/Missing value for --mode/);
		expect(() => parseDbSyncArgs(['--mode', 'migrate'])).toThrow(/Unknown mode/);
	});

	it('keeps args module free of orchestrator / mutation imports', () => {
		const source = readFileSync('scripts/db/db-sync-args.ts', 'utf8');
		expect(source).not.toMatch(/db-sync-orchestrator/);
		expect(source).not.toMatch(/preview-sync-invitations/);
		expect(source).not.toMatch(/invitation-promote/);
		expect(source).not.toMatch(/owner-production-apply/);
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
		expect(() => assertExactPlan(plan, null)).toThrow(/EXPECTED_PLAN_REQUIRED/);
		expect(() => assertPlanFresh(plan, new Date('2026-08-04T01:00:00.000Z'))).toThrow(
			/PLAN_EXPIRED/,
		);
		expect(gatesForDirection('package-to-production').ownerProductionApplyRequired).toBe(true);
	});

	it('changes planId when package hash or schema evidence changes', () => {
		const base = {
			direction: 'definition-to-preview' as const,
			slug: 'demo',
			packageHash: 'pkg-a',
			sourceHash: 'src',
			redactedSourceIdentity: 'package:pkg-a',
			redactedTargetIdentity: 'preview:redacted',
			dataFingerprint: 'data',
			assetFingerprint: 'assets',
			schemaEvidence: 'preview:CURRENT',
			now: new Date('2026-08-04T00:00:00.000Z'),
		};
		const a = buildDbSyncPlan(base);
		const b = buildDbSyncPlan({ ...base, packageHash: 'pkg-b' });
		const c = buildDbSyncPlan({ ...base, schemaEvidence: 'preview:BEHIND' });
		expect(a.planId).not.toBe(b.planId);
		expect(a.planId).not.toBe(c.planId);
	});

	it('encodes per-direction gates', () => {
		expect(gatesForDirection('definition-to-local')).toMatchObject({
			previewWriteAuthRequired: false,
			ownerProductionApplyRequired: false,
			rsvpResetDisclosureRequired: false,
		});
		expect(gatesForDirection('definition-to-preview').previewWriteAuthRequired).toBe(true);
		expect(gatesForDirection('package-to-production')).toMatchObject({
			previewApprovalRequired: true,
			releaseCheckRequired: true,
			criticalBackupRequired: true,
			ownerProductionApplyRequired: true,
		});
		expect(gatesForDirection('production-to-preview-mirror')).toMatchObject({
			previewWriteAuthRequired: true,
			rsvpResetDisclosureRequired: true,
		});
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

		const compareDrift = emptyResult('compare');
		compareDrift.ok = false;
		compareDrift.status = 'DRIFT';
		compareDrift.failures.push('SEMANTIC_DRIFT');
		expect(exitCodeForResult(compareDrift)).toBe(1);

		const planBlocked = emptyResult('plan');
		planBlocked.ok = false;
		planBlocked.status = 'PLAN_BLOCKED';
		planBlocked.failures.push('DIRECTION_REQUIRED');
		expect(exitCodeForResult(planBlocked)).toBe(1);
	});

	it('redacts nested sentinel secrets from JSON envelopes', () => {
		const sentinel = 'postgresql://postgres:sentinel-db-password-9f3a@db.host:5432/postgres';
		const result = emptyResult('diagnose');
		result.ok = false;
		result.failures.push(`nested cause: ${sentinel}`);
		result.artifacts.push({ kind: 'error', detail: `connection=${sentinel}` });
		const json = resultToJson(result);
		expect(json).not.toContain('sentinel-db-password-9f3a');
		expect(json).toContain('<redacted>');
		expect(json).not.toMatch(/:[^:/<"\s]{12,}@/);
	});
});

describe('db-sync specialized command compatibility', () => {
	it('retains specialized package aliases alongside db:sync', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['db:sync']).toMatch(/db-sync-cli/);
		expect(pkg.scripts['invitation:update']).toBeTruthy();
		expect(pkg.scripts['invitation:promote']).toBeTruthy();
		expect(pkg.scripts['invitation:content-parity']).toBeTruthy();
		expect(pkg.scripts['db:preview:sync-invitations']).toBeTruthy();
		expect(pkg.scripts.dbs).toBeTruthy();
		expect(pkg.scripts['db:migrate']).toBeTruthy();
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
