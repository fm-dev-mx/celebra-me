import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
	classifySqlText,
	evaluateMigrationSqlRisk,
	hasContractMetadata,
	normalizeSqlForRiskScan,
	SQL_RISK_CONTRACT_ENFORCEMENT_AFTER,
} from '../../scripts/db/migration-sql-risk';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';

describe('migration SQL risk classification', () => {
	it('allows initial permissions on a newly created table in the same transaction', () => {
		const sql = `BEGIN;
		CREATE TABLE public.new_table (id uuid primary key);
		CREATE INDEX new_table_idx ON public.new_table (id);
		ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
		ALTER TABLE public.new_table FORCE ROW LEVEL SECURITY;
		REVOKE ALL ON TABLE public.new_table FROM PUBLIC, anon, authenticated, service_role;
		GRANT SELECT, INSERT ON public.new_table TO service_role;
		COMMIT;`;
		expect(classifySqlText(sql).map((finding) => finding.kind)).toEqual(['ordinary']);
	});

	it.each([
		'CREATE TABLE public.t (id int); REVOKE ALL ON public.t FROM PUBLIC;',
		'BEGIN; CREATE TABLE IF NOT EXISTS public.t (id int); REVOKE ALL ON public.t FROM PUBLIC;',
		'BEGIN; CREATE TABLE public.t (id int); COMMIT; REVOKE ALL ON public.t FROM PUBLIC;',
		'BEGIN; CREATE TABLE public.t (id int); ROLLBACK; BEGIN; REVOKE ALL ON public.t FROM PUBLIC;',
		'BEGIN; REVOKE ALL ON public.t FROM PUBLIC; CREATE TABLE public.t (id int); COMMIT;',
		'BEGIN; CREATE TABLE public.t (id int); REVOKE ALL ON public.existing FROM PUBLIC; COMMIT;',
		'BEGIN; CREATE TABLE public.t (id int); REVOKE ALL ON other.t FROM PUBLIC; COMMIT;',
		'BEGIN; CREATE TABLE public.t (id int); REVOKE ALL ON public.t, public.existing FROM PUBLIC; COMMIT;',
		'BEGIN; CREATE TABLE public.t (id int); REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC; COMMIT;',
		'BEGIN; CREATE TABLE public.t (id int); ALTER TABLE public.t RENAME TO other; REVOKE ALL ON public.t FROM PUBLIC; COMMIT;',
		'BEGIN; SAVEPOINT s; CREATE TABLE public.t (id int); ROLLBACK TO s; REVOKE ALL ON public.t FROM PUBLIC; COMMIT;',
		'BEGIN; CREATE TABLE "public"."t" (id int); REVOKE ALL ON public.t FROM PUBLIC; COMMIT;',
		'BEGIN; CREATE TABLE t (id int); REVOKE ALL ON t FROM PUBLIC; COMMIT;',
		'BEGIN; CREATE TABLE public.t (id int); SELECT dangerous(); REVOKE ALL ON public.t FROM PUBLIC; COMMIT;',
		'BEGIN; CREATE TABLE public.t (id int); REVOKE ALL ON public.t FROM PUBLIC CASCADE; COMMIT;',
	])('retains the revoke guard for ambiguous or existing objects: %s', (sql) => {
		expect(classifySqlText(sql).some((finding) => finding.kind === 'destructive_revoke')).toBe(
			true,
		);
	});

	it('does not let an initial revoke hide a later unsafe revoke or other destructive SQL', () => {
		const sql =
			'BEGIN; CREATE TABLE public.t (id int); REVOKE ALL ON public.t FROM PUBLIC; REVOKE ALL ON public.old FROM PUBLIC; DROP TABLE public.old; COMMIT;';
		expect(classifySqlText(sql).map((finding) => finding.kind)).toEqual(
			expect.arrayContaining(['destructive_revoke', 'destructive_drop']),
		);
	});

	it.each([
		"BEGIN; CREATE TABLE public.t (v text default 'x; REVOKE'); REVOKE ALL ON public.t FROM PUBLIC; COMMIT;",
		"BEGIN; CREATE TABLE public.t (v text default '--'); REVOKE ALL ON public.t FROM PUBLIC; COMMIT;",
		'BEGIN; /* nested /* comment */ */ CREATE TABLE public.t (id int); REVOKE ALL ON public.t FROM PUBLIC; COMMIT;',
		'BEGIN; DO $$ BEGIN NULL; END $$; CREATE TABLE public.t (id int); REVOKE ALL ON public.t FROM PUBLIC; COMMIT;',
	])('fails closed for SQL requiring unsupported lexical interpretation: %s', (sql) => {
		expect(classifySqlText(sql).some((finding) => finding.kind === 'destructive_revoke')).toBe(
			true,
		);
	});

	it('allows the committed expand migration without changing its registry or SQL', () => {
		const version = '20260925182713';
		const registry = JSON.parse(
			fs.readFileSync(path.resolve('supabase/migration-rollout-registry.json'), 'utf8'),
		) as MigrationRolloutRegistry;
		const result = evaluateMigrationSqlRisk({ version, registry });
		expect(registry.migrations[version].phase).toBe('expand');
		expect(result.blocked).toBe(false);
		expect(result.risk.isDestructive).toBe(false);
	});

	it('treats additive SQL as ordinary', () => {
		const findings = classifySqlText(
			'CREATE TABLE public.example (id uuid PRIMARY KEY);\nGRANT SELECT ON public.example TO authenticated;',
		);
		expect(findings).toEqual([
			{ kind: 'ordinary', evidence: 'no destructive DDL/DCL patterns detected' },
		]);
	});

	it('ignores DROP inside dollar-quoted function bodies and comments', () => {
		const sql = `
-- DROP TABLE public.should_ignore;
CREATE OR REPLACE FUNCTION public.f() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- internal note about DROP TABLE
  NULL;
END;
$$;
`;
		expect(normalizeSqlForRiskScan(sql)).not.toMatch(/\bdrop\s+table\b/i);
		expect(classifySqlText(sql)[0]?.kind).toBe('ordinary');
	});

	it('detects DROP / REVOKE / TRUNCATE / ALTER DROP', () => {
		expect(
			classifySqlText('DROP TABLE public.t;').some((f) => f.kind === 'destructive_drop'),
		).toBe(true);
		expect(
			classifySqlText('REVOKE ALL ON TABLE public.t FROM PUBLIC;').some(
				(f) => f.kind === 'destructive_revoke',
			),
		).toBe(true);
		expect(
			classifySqlText('TRUNCATE public.t;').some((f) => f.kind === 'destructive_truncate'),
		).toBe(true);
		expect(
			classifySqlText('ALTER TABLE public.t DROP COLUMN legacy;').some(
				(f) => f.kind === 'destructive_alter_drop',
			),
		).toBe(true);
	});

	it('blocks post-cutoff destructive SQL without contract metadata', () => {
		const version = String(Number(SQL_RISK_CONTRACT_ENFORCEMENT_AFTER) + 1).padStart(14, '0');
		const registry: MigrationRolloutRegistry = { migrations: {} };
		const tmpSql = `DROP TABLE public.gone;`;
		const tmpFilePath = path.join(os.tmpdir(), `${version}_risk_test.sql`);
		fs.writeFileSync(tmpFilePath, tmpSql);
		try {
			const result = evaluateMigrationSqlRisk({ version, registry, sqlPath: tmpFilePath });
			expect(result.blocked).toBe(true);
			expect(result.reasons.join(' ')).toMatch(/phase=contract/);
		} finally {
			fs.rmSync(tmpFilePath, { force: true });
		}
	});

	it('allows destructive SQL with contract metadata', () => {
		const version = String(Number(SQL_RISK_CONTRACT_ENFORCEMENT_AFTER) + 2).padStart(14, '0');
		const registry: MigrationRolloutRegistry = {
			migrations: {
				[version]: {
					phase: 'contract',
					requiresDeployedAppCapabilities: ['replacement_client'],
					revokes: ['legacy_rpc'],
				},
			},
		};
		expect(hasContractMetadata(registry.migrations[version])).toBe(true);
		const tmpFilePath = path.join(os.tmpdir(), `${version}_risk_ok.sql`);
		fs.writeFileSync(tmpFilePath, 'DROP FUNCTION public.legacy();');
		try {
			const result = evaluateMigrationSqlRisk({ version, registry, sqlPath: tmpFilePath });
			expect(result.blocked).toBe(false);
		} finally {
			fs.rmSync(tmpFilePath, { force: true });
		}
	});

	it('grandfathers historical destructive SQL at or before cutoff', () => {
		const registry: MigrationRolloutRegistry = { migrations: {} };
		const tmpFilePath = path.join(
			os.tmpdir(),
			`${SQL_RISK_CONTRACT_ENFORCEMENT_AFTER}_risk_hist.sql`,
		);
		fs.writeFileSync(tmpFilePath, 'REVOKE ALL ON TABLE public.t FROM PUBLIC;');
		try {
			const result = evaluateMigrationSqlRisk({
				version: SQL_RISK_CONTRACT_ENFORCEMENT_AFTER,
				registry,
				sqlPath: tmpFilePath,
			});
			expect(result.blocked).toBe(false);
			expect(result.risk.isDestructive).toBe(true);
		} finally {
			fs.rmSync(tmpFilePath, { force: true });
		}
	});
});
