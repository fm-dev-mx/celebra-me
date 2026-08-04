import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockRunPsql = jest.fn((sql: string) => {
	if (typeof sql === 'string' && sql.includes('schema_migrations')) {
		return { status: 0, stdout: '', stderr: '' };
	}
	return {
		status: 0,
		stdout: JSON.stringify({ activeInvitationRows: 1, identityConflictsCount: 0, rows: [] }),
		stderr: '',
	};
});

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	PROJECT_ROOT: process.cwd(),
	runPsql: (...args: unknown[]) => mockRunPsql(...(args as [string])),
	runCommand: jest.fn(),
	sqlLiteral: (value: string) => `'${value}'`,
}));
jest.mock('../../scripts/db/db-guard.ts', () => ({
	classifyDbTarget: () => ({ target: 'persistent-local' }),
}));
jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	resolveDbUrlForEnv: (environment: string) => ({ dbUrl: `postgres://${environment}` }),
	listExpectedMigrationVersions: () => [],
}));
jest.mock('../../scripts/db/audit-db.ts', () => ({
	evaluateMigrationHistoryParity: () => ({
		isAligned: true,
		pendingLocal: [],
		extraRemote: [],
		isReordered: false,
		hasDivergentHistory: false,
		errors: [],
	}),
}));

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
	OBSERVABILITY_MAX_DB_INVOCATIONS,
	ObservabilityInvocationBudget,
	readEnvironmentDatabaseProjection,
	readMigrationProjection,
} from '../../scripts/observability/database-projection.ts';

describe('observability database resource budget', () => {
	beforeEach(() => {
		mockRunPsql.mockClear();
	});

	it('uses one content projection and one migration query per environment', () => {
		const budget = new ObservabilityInvocationBudget();
		for (const environment of ['local', 'preview', 'production'] as const) {
			readEnvironmentDatabaseProjection({
				environment,
				slugs: ['sample'],
				timeoutMs: 4_000,
				budget,
			});
			readMigrationProjection({ environment, timeoutMs: 4_000, budget });
		}
		expect(budget.used).toBe(OBSERVABILITY_MAX_DB_INVOCATIONS);
		// 3 content + 3 migration history reads, all via StatusProbeSession → runPsql
		expect(mockRunPsql).toHaveBeenCalledTimes(6);
		expect(
			((mockRunPsql.mock.calls[0] as unknown[])[2] as { env: NodeJS.ProcessEnv }).env
				.PGOPTIONS,
		).toBe('-c default_transaction_read_only=on');
		const migrationCall = mockRunPsql.mock.calls.find(
			(call) => typeof call[0] === 'string' && String(call[0]).includes('schema_migrations'),
		);
		expect(migrationCall).toBeDefined();
		expect(
			((migrationCall as unknown[])[2] as { env: NodeJS.ProcessEnv }).env.PGOPTIONS,
		).toContain('default_transaction_read_only=on');
	});

	it('fails closed before a seventh external database invocation', () => {
		const budget = new ObservabilityInvocationBudget();
		for (let index = 0; index < OBSERVABILITY_MAX_DB_INVOCATIONS; index += 1) {
			budget.consume();
		}
		expect(() => budget.consume()).toThrow(/OBSERVABILITY_DB_INVOCATION_BUDGET_EXCEEDED/);
	});

	it('does not import hook orchestration or managed-status policies', () => {
		const source = readFileSync(
			join(process.cwd(), 'scripts/observability/database-projection.ts'),
			'utf8',
		);
		expect(source).not.toMatch(/managed-status/);
		expect(source).not.toMatch(/HOOK_TIMEOUT/);
		expect(source).toMatch(/StatusProbeSession/);
		expect(source).toMatch(/readMigrationLifecycleForUrlSync/);
		expect(source).not.toMatch(/readMigrationLifecycleWithTimeout/);
	});
});
