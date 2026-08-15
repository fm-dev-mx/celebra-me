import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { runPsqlCommand } from '../../scripts/db/apply-migrations.ts';
import {
	executePsqlAtomicPending,
	executeSupabasePush,
} from '../../scripts/db/migrate-executors.ts';
import {
	OWNER_APPLY_LEDGER_GRANDFATHER_THROUGH,
	listOwnerApplyRecords,
	parseOwnerApplyRecord,
	writeOwnerApplyRecord,
} from '../../scripts/db/owner-apply-record.ts';
import {
	PRODUCTION_PROJECT_REF,
	evaluateAgentShellProductionMutation,
	evaluateMcpProductionMutation,
	evaluateShellProductionMutation,
	evaluateSpawnProductionMutation,
	isAgentContext,
	isReadOnlySql,
	maskSqlLiterals,
	wrapShellCommandWithAgentContext,
} from '../../scripts/db/production-boundary-policy.ts';
import { buildMutationSchemaContractQuery } from '../../scripts/db/mutation-schema-contract-query.ts';
import {
	buildRecoveryIntegrityCaptureSql,
	wrapRecoveryIntegrityPsqlInput,
} from '../../scripts/db/recovery-integrity.ts';
import { evaluateProductionAuthorizationIntegrity } from '../../scripts/db/production-authorization-integrity.ts';
import {
	clearProductionWritePermit,
	hasValidProductionWritePermit,
	issueProductionWritePermit,
	matchProductionWritePermit,
	resolveSpawnProductionBoundary,
	withProductionPermitScope,
} from '../../scripts/db/production-write-permit.ts';

const PROD_URL = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REFS.production}.supabase.co:5432/postgres`;
const PREVIEW_URL = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REFS.preview}.supabase.co:5432/postgres`;

function mockExit(): void {
	jest.spyOn(console, 'error').mockImplementation(() => undefined);
	jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
		throw new Error(`process.exit:${code ?? ''}`);
	}) as never);
}

afterEach(() => {
	clearProductionWritePermit();
	jest.restoreAllMocks();
});

describe('production boundary policy', () => {
	it('pins the Production project ref to the identity SSOT', () => {
		expect(PRODUCTION_PROJECT_REF).toBe(SUPABASE_PROJECT_REFS.production);
	});

	it('classifies read-only SQL fail-closed', () => {
		expect(isReadOnlySql('SELECT 1')).toBe(true);
		expect(isReadOnlySql('WITH x AS (SELECT 1) SELECT * FROM x')).toBe(true);
		expect(isReadOnlySql('BEGIN; SELECT 1; COMMIT;')).toBe(true);
		expect(isReadOnlySql('INSERT INTO t VALUES (1)')).toBe(false);
		expect(isReadOnlySql('SELECT * INTO tmp FROM t')).toBe(false);
		expect(isReadOnlySql('SELECT 1; DROP TABLE t')).toBe(false);
		expect(isReadOnlySql('SET ROLE postgres')).toBe(false);
		expect(
			isReadOnlySql(
				'COPY (select version::text from supabase_migrations.schema_migrations order by version) TO STDOUT',
			),
		).toBe(true);
		expect(isReadOnlySql('COPY public.invitations FROM STDIN')).toBe(false);
		expect(isReadOnlySql("COPY public.invitations FROM '/tmp/invitations.csv'")).toBe(false);
		expect(isReadOnlySql("SELECT 'UPDATE; DROP TABLE x; LOCK TABLE y' AS text")).toBe(true);
		expect(isReadOnlySql('SELECT $$UPDATE; DROP TABLE x;$$ AS text')).toBe(true);
		expect(isReadOnlySql("SELECT 'x''UPDATE y SET z = 1' AS text")).toBe(true);
		expect(isReadOnlySql('SELECT 1 FROM t FOR UPDATE')).toBe(false);
		expect(
			isReadOnlySql('WITH changed AS (UPDATE t SET x = 1 RETURNING *) SELECT * FROM changed'),
		).toBe(false);
		expect(isReadOnlySql(buildMutationSchemaContractQuery())).toBe(true);
		expect(
			isReadOnlySql(
				wrapRecoveryIntegrityPsqlInput(buildRecoveryIntegrityCaptureSql('phase3')),
			),
		).toBe(true);
		expect(maskSqlLiterals("SELECT 'UPDATE' AS value")).not.toContain('UPDATE');
	});

	it('wraps agent shell commands with CELEBRA_AGENT_CONTEXT and ignores false/0 overrides', () => {
		expect(wrapShellCommandWithAgentContext('pnpm db:migrate -- --target preview')).toBe(
			"$env:CELEBRA_AGENT_CONTEXT='1'; pnpm db:migrate -- --target preview",
		);
		expect(wrapShellCommandWithAgentContext("$env:CELEBRA_AGENT_CONTEXT='1'; pnpm dbs")).toBe(
			"$env:CELEBRA_AGENT_CONTEXT='1'; pnpm dbs",
		);
		expect(
			wrapShellCommandWithAgentContext(
				"$env:CELEBRA_AGENT_CONTEXT='false'; pnpm prod:apply --apply",
			),
		).toBe("$env:CELEBRA_AGENT_CONTEXT='1'; pnpm prod:apply --apply");
		expect(wrapShellCommandWithAgentContext('$env:CELEBRA_AGENT_CONTEXT=0; pnpm dbs')).toBe(
			"$env:CELEBRA_AGENT_CONTEXT='1'; pnpm dbs",
		);
		expect(wrapShellCommandWithAgentContext('CELEBRA_AGENT_CONTEXT=false pnpm dbs')).toBe(
			"$env:CELEBRA_AGENT_CONTEXT='1'; pnpm dbs",
		);
	});

	it('denies MCP Production writes and allows read-only Production SQL', () => {
		expect(
			evaluateMcpProductionMutation({
				tool_name: 'apply_migration',
				arguments: { project_id: PRODUCTION_PROJECT_REF, name: 'x', query: 'select 1' },
			}).permission,
		).toBe('deny');
		expect(
			evaluateMcpProductionMutation({
				toolName: 'execute_sql',
				arguments: {
					project_id: PRODUCTION_PROJECT_REF,
					query: 'SELECT version FROM supabase_migrations.schema_migrations',
				},
			}).permission,
		).toBe('allow');
		expect(
			evaluateMcpProductionMutation({
				tool_name: 'execute_sql',
				arguments: {
					project_id: PRODUCTION_PROJECT_REF,
					query: 'CREATE TABLE pwned (id int)',
				},
			}).code,
		).toBe('MCP_PRODUCTION_SQL_BLOCKED');
		expect(
			evaluateMcpProductionMutation({
				tool_name: 'execute_sql',
				arguments: {
					project_id: SUPABASE_PROJECT_REFS.preview,
					query: 'CREATE TABLE ok (id int)',
				},
			}).permission,
		).toBe('allow');
		expect(
			evaluateMcpProductionMutation({
				tool_name: 'list_migrations',
				arguments: { project_id: PRODUCTION_PROJECT_REF },
			}).permission,
		).toBe('allow');
	});

	it('denies raw Production CLI and allows canonical owner wrappers and read-only psql', () => {
		expect(
			evaluateShellProductionMutation(`supabase db push --db-url ${PROD_URL} --yes`).code,
		).toBe('PRODUCTION_RAW_CLI_BLOCKED');
		expect(evaluateShellProductionMutation('supabase db push --linked --yes').code).toBe(
			'RAW_SUPABASE_LINKED_PUSH_BLOCKED',
		);
		expect(
			evaluateShellProductionMutation('pnpm db:migrate -- --target production --apply')
				.permission,
		).toBe('allow');
		expect(
			evaluateShellProductionMutation(`psql --dbname ${PROD_URL} -c "SELECT 1"`).permission,
		).toBe('allow');
		expect(
			evaluateShellProductionMutation(
				`psql --dbname ${PROD_URL} -c "DROP TABLE public.invitations"`,
			).code,
		).toBe('PRODUCTION_RAW_PSQL_BLOCKED');
		expect(
			evaluateShellProductionMutation(`supabase db push --db-url ${PROD_URL} --dry-run`)
				.permission,
		).toBe('allow');
	});

	it('denies canonical Production --apply from the agent shell evaluator', () => {
		expect(
			evaluateAgentShellProductionMutation('pnpm db:migrate -- --target production --apply')
				.code,
		).toBe('AGENT_PRODUCTION_APPLY_BLOCKED');
		expect(
			evaluateAgentShellProductionMutation(
				'pnpm invitation:release -- --slug demo --targets production --apply',
			).code,
		).toBe('AGENT_PRODUCTION_APPLY_BLOCKED');
		expect(
			evaluateAgentShellProductionMutation('pnpm prod:apply -- --all-ready --apply').code,
		).toBe('AGENT_PRODUCTION_APPLY_BLOCKED');
		expect(
			evaluateAgentShellProductionMutation('pnpm db:prod:patch -- --apply --file x.sql').code,
		).toBe('AGENT_PRODUCTION_APPLY_BLOCKED');
		expect(
			evaluateAgentShellProductionMutation('pnpm prod:apply -- --all-ready').permission,
		).toBe('allow');
		expect(
			evaluateAgentShellProductionMutation(
				'pnpm invitation:release -- --slug demo --targets preview --apply',
			).permission,
		).toBe('allow');
		expect(
			evaluateAgentShellProductionMutation('pnpm db:migrate -- --target production')
				.permission,
		).toBe('allow');
		expect(evaluateAgentShellProductionMutation('pnpm db:migrate --apply').code).toBe(
			'AGENT_PRODUCTION_APPLY_BLOCKED',
		);
		expect(
			evaluateAgentShellProductionMutation('pnpm db:migrate -- --target preview --apply')
				.permission,
		).toBe('allow');
		expect(
			evaluateAgentShellProductionMutation('pnpm db:migrate -- --target local --apply')
				.permission,
		).toBe('allow');
		expect(
			evaluateAgentShellProductionMutation(
				'pnpm db:migrate -- --target disposable-test --apply',
			).permission,
		).toBe('allow');
	});

	it('treats false, 0, and empty CELEBRA_AGENT_CONTEXT as agent context', () => {
		expect(isAgentContext({ CELEBRA_AGENT_CONTEXT: 'false' })).toBe(true);
		expect(isAgentContext({ CELEBRA_AGENT_CONTEXT: '0' })).toBe(true);
		expect(isAgentContext({ CELEBRA_AGENT_CONTEXT: '' })).toBe(true);
		expect(isAgentContext({ CELEBRA_AGENT_CONTEXT: '1' })).toBe(true);
		expect(isAgentContext({})).toBe(false);
	});
});

describe('production write permit', () => {
	it('does not allow Production push without a permit', () => {
		const decision = resolveSpawnProductionBoundary('supabase', [
			'db',
			'push',
			'--db-url',
			PROD_URL,
			'--yes',
		]);
		expect(decision.permission).toBe('deny');
		expect(decision.code).toBe('PRODUCTION_WRITE_PERMIT_REQUIRED');
	});

	it('allows Production push only after an in-process owner permit bound to the same plan', () => {
		issueProductionWritePermit({
			projectRef: SUPABASE_PROJECT_REFS.production,
			operationType: 'production_migration',
			bindingHex: 'abcdef01',
		});
		expect(hasValidProductionWritePermit(PROD_URL)).toBe(true);
		expect(hasValidProductionWritePermit(PROD_URL, Date.now(), 'abcdef01')).toBe(true);
		expect(hasValidProductionWritePermit(PROD_URL, Date.now(), 'ffffffff')).toBe(false);
		expect(
			hasValidProductionWritePermit(PROD_URL, Date.now(), 'abcdef01', 'production_apply'),
		).toBe(false);
		expect(
			resolveSpawnProductionBoundary(
				'supabase',
				['db', 'push', '--db-url', PROD_URL, '--yes'],
				{
					productionPermit: {
						bindingHex: 'abcdef01',
						operationType: 'production_migration',
					},
				},
			).permission,
		).toBe('allow');
		expect(
			resolveSpawnProductionBoundary('supabase', [
				'db',
				'push',
				'--db-url',
				PROD_URL,
				'--yes',
			]).permission,
		).toBe('deny');
		expect(
			evaluateSpawnProductionMutation('npx', [
				'supabase',
				'db',
				'push',
				'--db-url',
				PROD_URL,
				'--yes',
			]).code,
		).toBe('PRODUCTION_WRITE_PERMIT_REQUIRED');
		expect(
			evaluateSpawnProductionMutation('supabase', [
				'db',
				'push',
				'--db-url',
				PREVIEW_URL,
				'--yes',
			]).permission,
		).toBe('allow');
	});

	it('allows Production SELECT through psql without a permit', () => {
		expect(
			resolveSpawnProductionBoundary('psql', ['--dbname', PROD_URL], { input: 'SELECT 1' })
				.permission,
		).toBe('allow');
	});

	it('rejects expired, wrong-project, and wrong-plan permits', () => {
		issueProductionWritePermit({
			projectRef: SUPABASE_PROJECT_REFS.production,
			operationType: 'production_apply',
			bindingHex: 'plan-aaaa',
			nowMs: 1_000,
		});
		expect(hasValidProductionWritePermit(PROD_URL, 1_000 + 31 * 60 * 1000)).toBe(false);
		issueProductionWritePermit({
			projectRef: SUPABASE_PROJECT_REFS.production,
			operationType: 'production_apply',
			bindingHex: 'plan-bbbb',
		});
		expect(hasValidProductionWritePermit(PREVIEW_URL)).toBe(false);
		expect(hasValidProductionWritePermit(PROD_URL, Date.now(), 'plan-cccc')).toBe(false);
		expect(
			matchProductionWritePermit({
				dbUrl: PROD_URL,
				bindingHex: 'plan-cccc',
				operationType: 'production_apply',
			}),
		).toBe('binding');
		expect(
			matchProductionWritePermit({
				dbUrl: PREVIEW_URL,
				bindingHex: 'plan-bbbb',
				operationType: 'production_apply',
			}),
		).toBe('project');
		expect(
			matchProductionWritePermit({
				dbUrl: PROD_URL,
				bindingHex: 'plan-bbbb',
				operationType: 'production_migration',
			}),
		).toBe('operation');
	});

	it('does not let a valid 30-minute permit escape its exact operation scope', () => {
		issueProductionWritePermit({
			projectRef: SUPABASE_PROJECT_REFS.production,
			operationType: 'promotion',
			bindingHex: 'package-aaaa',
		});
		const command = ['--dbname', PROD_URL];
		expect(
			resolveSpawnProductionBoundary('psql', command, {
				input: "UPDATE public.invitations SET title = 'x'",
			}).permission,
		).toBe('deny');

		const scopedDecision = withProductionPermitScope(
			{ bindingHex: 'package-aaaa', operationType: 'promotion' },
			() =>
				resolveSpawnProductionBoundary('psql', command, {
					input: "UPDATE public.invitations SET title = 'x'",
				}),
		);
		expect(scopedDecision.permission).toBe('allow');

		const mismatchedScope = withProductionPermitScope(
			{ bindingHex: 'package-bbbb', operationType: 'promotion' },
			() =>
				resolveSpawnProductionBoundary('psql', command, {
					input: "UPDATE public.invitations SET title = 'x'",
				}),
		);
		expect(mismatchedScope.permission).toBe('deny');
	});
});

describe('owner-apply ledger and authorization integrity', () => {
	it('persists authorization evidence without secrets and distinguishes it from schema parity', () => {
		const ledgerDir = mkdtempSync(join(tmpdir(), 'owner-apply-'));
		try {
			const { record, path } = writeOwnerApplyRecord(
				{
					operationType: 'production_migration',
					operationVerb: 'MIGRATE',
					migrationVersions: ['20260807120000'],
					planId: 'aa'.repeat(32),
					releaseSha: 'abc1234',
					projectRef: SUPABASE_PROJECT_REFS.production,
					worktree: 'dev-local',
				},
				{ ledgerDir },
			);
			const raw = readFileSync(path, 'utf8');
			expect(raw).not.toMatch(/postgres:\/\//);
			expect(raw).not.toContain('secret');
			expect(parseOwnerApplyRecord(JSON.parse(raw))?.authorized).toBe(true);
			expect(listOwnerApplyRecords({ ledgerDir })).toHaveLength(1);
			expect(record.result).toBe('authorized_applied');

			const missing = evaluateProductionAuthorizationIntegrity({
				environment: 'production',
				evidence: 'LIVE',
				appliedVersions: [OWNER_APPLY_LEDGER_GRANDFATHER_THROUGH, '20260807120000'],
				records: [],
			});
			expect(missing.status).toBe('MISSING');
			expect(missing.missingVersions).toEqual(['20260807120000']);

			const recorded = evaluateProductionAuthorizationIntegrity({
				environment: 'production',
				evidence: 'LIVE',
				appliedVersions: [OWNER_APPLY_LEDGER_GRANDFATHER_THROUGH, '20260807120000'],
				records: [record],
			});
			expect(recorded.status).toBe('RECORDED');

			const grandfathered = evaluateProductionAuthorizationIntegrity({
				environment: 'production',
				evidence: 'LIVE',
				appliedVersions: [OWNER_APPLY_LEDGER_GRANDFATHER_THROUGH],
				records: [],
			});
			expect(grandfathered.status).toBe('GRANDFATHERED');
			expect(
				evaluateProductionAuthorizationIntegrity({
					environment: 'preview',
					evidence: 'LIVE',
					appliedVersions: ['20260807120000'],
				}).status,
			).toBe('NOT_APPLICABLE');
		} finally {
			rmSync(ledgerDir, { recursive: true, force: true });
		}
	});
});

describe('lowest-level Production write helpers fail closed', () => {
	it('refuses apply-migrations psql against Production', () => {
		const result = runPsqlCommand(PROD_URL, 'SELECT 1');
		expect(result.ok).toBe(false);
		expect(result.output).toMatch(/cannot target production/);
	});

	it('refuses apply-migrations psql against Preview and unknown targets', () => {
		expect(runPsqlCommand(PREVIEW_URL, 'SELECT 1').ok).toBe(false);
		expect(runPsqlCommand(PREVIEW_URL, 'SELECT 1').output).toMatch(/cannot target preview/);
		expect(
			runPsqlCommand('postgresql://user:secret@example.com:5432/postgres', 'SELECT 1').ok,
		).toBe(false);
	});

	it('refuses executePsqlAtomicPending against Production, Preview, and invalid targets', () => {
		mockExit();
		expect(() =>
			executePsqlAtomicPending({ dbUrl: PROD_URL, pendingVersions: ['20260807120000'] }),
		).toThrow('process.exit:1');
		expect(() =>
			executePsqlAtomicPending({ dbUrl: PREVIEW_URL, pendingVersions: ['20260807120000'] }),
		).toThrow('process.exit:1');
		expect(() =>
			executePsqlAtomicPending({
				dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54332/postgres',
				pendingVersions: ['20260807120000'],
			}),
		).toThrow('process.exit:1');
	});

	it('cannot mutate schema through the removed apply-migrations CLI', () => {
		const source = readFileSync(join(process.cwd(), 'scripts/db/apply-migrations.ts'), 'utf8');
		expect(source).not.toMatch(/function main\s*\(/);
		expect(source).not.toMatch(/process\.argv\[1\]\?\.endsWith\('apply-migrations\.ts'\)/);
		expect(source).not.toContain('Applying ${files.length} migrations');
	});

	it('refuses executeSupabasePush against Production without a permit', () => {
		mockExit();
		expect(() => executeSupabasePush(PROD_URL)).toThrow('process.exit:1');
	});
});
