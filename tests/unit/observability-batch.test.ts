const mockRunPsql = jest.fn(() => ({
	status: 0,
	stdout: JSON.stringify({ activeInvitationRows: 1, identityConflictsCount: 0, rows: [] }),
	stderr: '',
}));
const mockRunCommand = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	runPsql: mockRunPsql,
	runCommand: mockRunCommand,
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
	fetchRemoteMigrationVersions: (
		_url: string,
		runner: (command: string, args: string[], options: object) => unknown,
	) => {
		runner('psql', [], {});
		return { remoteVersions: [], isUninitialized: false };
	},
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
		mockRunCommand.mockClear();
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
		expect(mockRunPsql).toHaveBeenCalledTimes(3);
		expect(mockRunCommand).toHaveBeenCalledTimes(3);
		expect(
			((mockRunPsql.mock.calls[0] as unknown[])[2] as { env: NodeJS.ProcessEnv }).env
				.PGOPTIONS,
		).toBe('-c default_transaction_read_only=on');
		expect(
			((mockRunCommand.mock.calls[0] as unknown[])[2] as { env: NodeJS.ProcessEnv }).env
				.PGOPTIONS,
		).toBe('-c default_transaction_read_only=on');
	});

	it('fails closed before a seventh external database invocation', () => {
		const budget = new ObservabilityInvocationBudget();
		for (let index = 0; index < OBSERVABILITY_MAX_DB_INVOCATIONS; index += 1) {
			budget.consume();
		}
		expect(() => budget.consume()).toThrow('OBSERVABILITY_DB_INVOCATION_BUDGET_EXCEEDED');
	});

	it('projects asset keys for every row but gates full asset references behind detail demand', () => {
		const budget = new ObservabilityInvocationBudget();
		readEnvironmentDatabaseProjection({
			environment: 'local',
			slugs: ['sample'],
			timeoutMs: 4_000,
			budget,
		});
		const sql = String((mockRunPsql.mock.calls[0] as unknown[] | undefined)?.[0]);
		expect(sql).toContain("'managedAssetKeys', managed_asset_keys");
		expect(sql).toMatch(/'managedAssets', CASE\s+WHEN detail_required/);
	});
});
