import {
	classifySqlText,
	evaluateMigrationSqlRisk,
	hasContractMetadata,
	normalizeSqlForRiskScan,
	SQL_RISK_CONTRACT_ENFORCEMENT_AFTER,
} from '../../scripts/db/migration-sql-risk';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';

describe('migration SQL risk classification', () => {
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
		expect(classifySqlText('DROP TABLE public.t;').some((f) => f.kind === 'destructive_drop')).toBe(
			true,
		);
		expect(classifySqlText('REVOKE ALL ON TABLE public.t FROM PUBLIC;').some((f) => f.kind === 'destructive_revoke')).toBe(
			true,
		);
		expect(classifySqlText('TRUNCATE public.t;').some((f) => f.kind === 'destructive_truncate')).toBe(
			true,
		);
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
		const path = require('node:path').join(
			require('node:os').tmpdir(),
			`${version}_risk_test.sql`,
		);
		require('node:fs').writeFileSync(path, tmpSql);
		const result = evaluateMigrationSqlRisk({ version, registry, sqlPath: path });
		expect(result.blocked).toBe(true);
		expect(result.reasons.join(' ')).toMatch(/phase=contract/);
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
		const path = require('node:path').join(
			require('node:os').tmpdir(),
			`${version}_risk_ok.sql`,
		);
		require('node:fs').writeFileSync(path, 'DROP FUNCTION public.legacy();');
		const result = evaluateMigrationSqlRisk({ version, registry, sqlPath: path });
		expect(result.blocked).toBe(false);
	});

	it('grandfathers historical destructive SQL at or before cutoff', () => {
		const registry: MigrationRolloutRegistry = { migrations: {} };
		const path = require('node:path').join(
			require('node:os').tmpdir(),
			`${SQL_RISK_CONTRACT_ENFORCEMENT_AFTER}_risk_hist.sql`,
		);
		require('node:fs').writeFileSync(path, 'REVOKE ALL ON TABLE public.t FROM PUBLIC;');
		const result = evaluateMigrationSqlRisk({
			version: SQL_RISK_CONTRACT_ENFORCEMENT_AFTER,
			registry,
			sqlPath: path,
		});
		expect(result.blocked).toBe(false);
		expect(result.risk.isDestructive).toBe(true);
	});
});
