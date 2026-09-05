import { describe, expect, it } from '@jest/globals';
import {
	buildSchemaAuditVerdict,
	compareTargetToCanonicalReference,
	extractDroppedPoliciesFromSql,
	parseSchemaAuditVerdictFromOutput,
	runCanonicalObjectAudit,
	type SchemaMetadata,
} from '../../scripts/db/audit-db.ts';
import {
	classifyDbTarget,
	DISPOSABLE_DB_URL,
	LOCAL_DB_URL,
} from '../../scripts/db/db-target-config.ts';
import {
	CANONICAL_REFERENCE_TABLES,
	evaluateDisposableReference,
	REFERENCE_INVALID_LIFECYCLE,
	type DisposableReferenceInput,
} from '../../scripts/db/disposable-reference.ts';
import { isAllowlistedBehindAuditOutput } from '../../scripts/db/migrate-policy-production.ts';

const EXPECTED_VERSIONS = ['20260215000100', '20260215000200', '20260812210000'] as const;

function emptySchema(tableNames: readonly string[] = []): SchemaMetadata {
	return {
		tables: tableNames.map((tableName) => ({ tableName, tableType: 'BASE TABLE' })),
		columns: [],
		constraints: [],
		indexes: [],
		policies: [],
		triggers: [],
		routines: [],
		grants: [],
	};
}

function validReferenceInput(
	overrides: Partial<DisposableReferenceInput> = {},
): DisposableReferenceInput {
	return {
		reachable: true,
		classificationTarget: 'disposable-test',
		expectedVersions: EXPECTED_VERSIONS,
		liveVersions: [...EXPECTED_VERSIONS],
		liveTableNames: [...CANONICAL_REFERENCE_TABLES],
		proofOk: true,
		proofAppliedVersions: [...EXPECTED_VERSIONS],
		...overrides,
	};
}

describe('evaluateDisposableReference', () => {
	it('accepts a current reconstruction with required contract tables', () => {
		const verdict = evaluateDisposableReference(validReferenceInput());
		expect(verdict.ok).toBe(true);
		expect(verdict.lifecycle).toBe('VALID');
		expect(verdict.missingTables).toEqual([]);
	});

	it('fails closed when the disposable reference is unreachable', () => {
		const verdict = evaluateDisposableReference(
			validReferenceInput({ reachable: false, liveVersions: null, liveTableNames: null }),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.lifecycle).toBe(REFERENCE_INVALID_LIFECYCLE);
		expect(verdict.cause).toBe('unreachable');
	});

	it('includes start failure detail when the disposable reference is unreachable', () => {
		const verdict = evaluateDisposableReference(
			validReferenceInput({
				reachable: false,
				liveVersions: null,
				liveTableNames: null,
				introspectionError: 'Database did not become ready in time.',
			}),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.cause).toBe('unreachable');
		expect(verdict.reason).toContain('Database did not become ready in time.');
	});

	it('fails closed when introspection is pointed at persistent-local instead of disposable-test', () => {
		expect(classifyDbTarget(LOCAL_DB_URL).target).toBe('persistent-local');
		expect(classifyDbTarget(DISPOSABLE_DB_URL).target).toBe('disposable-test');
		const verdict = evaluateDisposableReference(
			validReferenceInput({
				classificationTarget: classifyDbTarget(LOCAL_DB_URL).target,
			}),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.cause).toBe('wrong_target');
		expect(verdict.reason).toContain('persistent-local');
	});

	it('fails closed when reference introspection throws', () => {
		const verdict = evaluateDisposableReference(
			validReferenceInput({
				liveVersions: null,
				liveTableNames: null,
				introspectionError: 'psql: connection reset during schema query',
			}),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.cause).toBe('introspection_failed');
		expect(verdict.reason).toContain('connection reset');
	});

	it('classifies a live database that does not match the current proof as stale or reused', () => {
		const verdict = evaluateDisposableReference(
			validReferenceInput({
				liveVersions: EXPECTED_VERSIONS.slice(0, 2),
				liveTableNames: [...CANONICAL_REFERENCE_TABLES],
			}),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.cause).toBe('stale_or_reused');
	});

	it('classifies history that is behind the workspace while required tables exist', () => {
		const verdict = evaluateDisposableReference(
			validReferenceInput({
				proofOk: false,
				proofAppliedVersions: null,
				liveVersions: EXPECTED_VERSIONS.slice(0, 2),
				liveTableNames: [...CANONICAL_REFERENCE_TABLES],
			}),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.cause).toBe('history_mismatch');
	});

	it('classifies an incomplete reconstruction missing historical tables', () => {
		const verdict = evaluateDisposableReference(
			validReferenceInput({
				proofOk: false,
				proofAppliedVersions: null,
				liveVersions: [],
				liveTableNames: ['invitations'],
			}),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.cause).toBe('schema_incomplete');
		expect(verdict.missingTables).toEqual(
			expect.arrayContaining(['events', 'guest_invitations']),
		);
	});

	it('reproduces the live failure: proof/history current while material schema is incomplete', () => {
		const incompleteTables = [
			'invitation_content_drafts',
			'invitations',
			'published_invitation_content',
		];
		const verdict = evaluateDisposableReference(
			validReferenceInput({ liveTableNames: incompleteTables }),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.cause).toBe('incoherent_history_and_schema');
		expect(verdict.missingTables).toEqual(
			CANONICAL_REFERENCE_TABLES.filter(
				(tableName) => !incompleteTables.includes(tableName),
			),
		);
	});

	it('fails closed when history is current but a later contract table is missing', () => {
		const verdict = evaluateDisposableReference(
			validReferenceInput({
				liveTableNames: CANONICAL_REFERENCE_TABLES.filter(
					(tableName) => tableName !== 'invitation_assets',
				),
			}),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.cause).toBe('incoherent_history_and_schema');
		expect(verdict.missingTables).toEqual(['invitation_assets']);
	});
});

describe('runCanonicalObjectAudit', () => {
	const productionSchema = emptySchema(CANONICAL_REFERENCE_TABLES);

	it('does not classify Production tables as drift when the disposable reference is incomplete', () => {
		const incompleteTables = [
			'invitation_content_drafts',
			'invitations',
			'published_invitation_content',
		];
		const result = runCanonicalObjectAudit({
			target: 'production',
			historyLifecycle: 'BEHIND',
			extraRemoteCount: 0,
			reference: validReferenceInput({ liveTableNames: incompleteTables }),
			targetSchema: productionSchema,
			referenceSchema: emptySchema(incompleteTables),
		});

		expect(result.lifecycle).toBe(REFERENCE_INVALID_LIFECYCLE);
		expect(result.reference.cause).toBe('incoherent_history_and_schema');
		expect(result.comparison).toBeNull();
		expect(buildSchemaAuditVerdict(result.lifecycle, result.errorCount).readyForMigrate).toBe(
			false,
		);
	});

	it('does not classify Production drift when a later contract table is missing from disposable', () => {
		const incompleteTables = CANONICAL_REFERENCE_TABLES.filter(
			(tableName) => tableName !== 'invitation_assets',
		);
		const result = runCanonicalObjectAudit({
			target: 'production',
			historyLifecycle: 'CURRENT',
			extraRemoteCount: 0,
			reference: validReferenceInput({ liveTableNames: incompleteTables }),
			targetSchema: productionSchema,
			referenceSchema: emptySchema(incompleteTables),
		});

		expect(result.lifecycle).toBe(REFERENCE_INVALID_LIFECYCLE);
		expect(result.reference.cause).toBe('incoherent_history_and_schema');
		expect(result.reference.missingTables).toEqual(['invitation_assets']);
		expect(result.comparison).toBeNull();
	});

	it('legacy comparison against the incomplete reference would have reported Production tables as missing locally', () => {
		const comparison = compareTargetToCanonicalReference(
			'production',
			productionSchema,
			emptySchema([
				'invitation_content_drafts',
				'invitations',
				'published_invitation_content',
			]),
			'BEHIND',
		);
		expect(comparison.errors).toEqual(
			expect.arrayContaining([
				'Table "events" exists in target but is missing locally!',
				'Table "guest_invitations" exists in target but is missing locally!',
				'Table "production_authorization_receipts" exists in target but is missing locally!',
			]),
		);
	});

	it('reports expected BEHIND without object errors when the reference is valid', () => {
		const canonical = emptySchema(CANONICAL_REFERENCE_TABLES);
		const result = runCanonicalObjectAudit({
			target: 'production',
			historyLifecycle: 'BEHIND',
			extraRemoteCount: 0,
			reference: validReferenceInput(),
			targetSchema: canonical,
			referenceSchema: canonical,
		});
		expect(result.lifecycle).toBe('BEHIND');
		expect(result.comparison).not.toBeNull();
		expect(result.comparison?.errors).toEqual([]);
		expect(result.errorCount).toBe(0);
		expect(buildSchemaAuditVerdict(result.lifecycle, result.errorCount).readyForMigrate).toBe(
			true,
		);
	});

	it('still reports genuine Production drift against a validated reference', () => {
		const referenceSchema = emptySchema(CANONICAL_REFERENCE_TABLES);
		const driftedProduction: SchemaMetadata = {
			...emptySchema(CANONICAL_REFERENCE_TABLES),
			policies: [
				{
					tableName: 'events',
					policyName: 'unexpected_prod_policy',
					roles: '{authenticated}',
					cmd: 'SELECT',
					qual: 'true',
					withCheck: null,
				},
			],
		};
		const result = runCanonicalObjectAudit({
			target: 'production',
			historyLifecycle: 'CURRENT',
			extraRemoteCount: 0,
			reference: validReferenceInput(),
			targetSchema: driftedProduction,
			referenceSchema,
		});
		expect(result.lifecycle).toBe('CURRENT');
		expect(result.comparison?.errors).toEqual([
			'RLS Policy "unexpected_prod_policy" on "events" is missing locally!',
		]);
		expect(result.errorCount).toBe(1);
		expect(buildSchemaAuditVerdict(result.lifecycle, result.errorCount).readyForMigrate).toBe(
			false,
		);
		expect(buildSchemaAuditVerdict(result.lifecycle, result.errorCount).passedStandalone).toBe(
			false,
		);
	});

	it('treats policies dropped in pending migrations as non-blocking info when BEHIND', () => {
		const referenceSchema = emptySchema(CANONICAL_REFERENCE_TABLES);
		const targetWithDroppedPolicy: SchemaMetadata = {
			...emptySchema(CANONICAL_REFERENCE_TABLES),
			policies: [
				{
					tableName: 'events',
					policyName: 'Events: owner can manage',
					roles: '{authenticated}',
					cmd: 'ALL',
					qual: 'true',
					withCheck: null,
				},
			],
		};
		const result = runCanonicalObjectAudit({
			target: 'production',
			historyLifecycle: 'BEHIND',
			extraRemoteCount: 0,
			reference: validReferenceInput(),
			targetSchema: targetWithDroppedPolicy,
			referenceSchema,
			allowedDroppedPolicies: new Set(['events:Events: owner can manage']),
		});
		expect(result.lifecycle).toBe('BEHIND');
		expect(result.comparison?.errors).toEqual([]);
		expect(result.comparison?.infos).toContain(
			'RLS Policy "Events: owner can manage" on "events" is target-only (expected drop in pending migrations).',
		);
		expect(result.errorCount).toBe(0);
		expect(buildSchemaAuditVerdict(result.lifecycle, result.errorCount).readyForMigrate).toBe(
			true,
		);
	});

	it('fails closed when reference creation/start does not produce a reachable database', () => {
		const result = runCanonicalObjectAudit({
			target: 'production',
			historyLifecycle: 'BEHIND',
			extraRemoteCount: 0,
			reference: validReferenceInput({
				reachable: false,
				liveVersions: null,
				liveTableNames: null,
				introspectionError: 'Database did not become ready in time.',
			}),
			targetSchema: productionSchema,
			referenceSchema: null,
		});
		expect(result.lifecycle).toBe(REFERENCE_INVALID_LIFECYCLE);
		expect(result.reference.cause).toBe('unreachable');
		expect(result.comparison).toBeNull();
	});
});

describe('audit verdict parsing for reference failure', () => {
	it('does not treat REFERENCE_INVALID as allowlisted Production migrate preflight', () => {
		const output = ['Final schema lifecycle state: REFERENCE_INVALID', 'Errors: 1'].join('\n');
		expect(parseSchemaAuditVerdictFromOutput(output, 1).readyForMigrate).toBe(false);
		expect(parseSchemaAuditVerdictFromOutput(output, 1).lifecycle).toBe(
			REFERENCE_INVALID_LIFECYCLE,
		);
		expect(isAllowlistedBehindAuditOutput(output, 1)).toBe(false);
	});
});

describe('extractDroppedPoliciesFromSql', () => {
	it('extracts quoted policy names and public table', () => {
		const sql = `DROP POLICY IF EXISTS "Events: owner can manage" ON public.events;`;
		expect(extractDroppedPoliciesFromSql(sql)).toEqual(
			new Set(['events:Events: owner can manage']),
		);
	});

	it('extracts unquoted policy names and unquoted tables', () => {
		const sql = `drop policy if exists rsvp_records_no_access_anon on public.rsvp_records;`;
		expect(extractDroppedPoliciesFromSql(sql)).toEqual(
			new Set(['rsvp_records:rsvp_records_no_access_anon']),
		);
	});

	it('handles multiline statements across newlines', () => {
		const sql = `
			drop policy if exists "Admins can manage invitation projects"
				on public.invitations;
		`;
		expect(extractDroppedPoliciesFromSql(sql)).toEqual(
			new Set(['invitations:Admins can manage invitation projects']),
		);
	});

	it('handles quoted schema prefix "public".', () => {
		const sql = `DROP POLICY IF EXISTS "Events: owner can manage" ON "public"."events";`;
		expect(extractDroppedPoliciesFromSql(sql)).toEqual(
			new Set(['events:Events: owner can manage']),
		);
	});

	it('ignores commented-out drop policy statements', () => {
		const sql = `
			-- drop policy if exists old_policy on public.events;
			/*
			drop policy if exists block_policy on public.events;
			*/
			drop policy if exists active_policy on public.events;
		`;
		expect(extractDroppedPoliciesFromSql(sql)).toEqual(new Set(['events:active_policy']));
	});
});

