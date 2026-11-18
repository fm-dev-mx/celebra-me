/** @jest-environment node */
import { ensureCriticalProductionBackup } from '../../scripts/db/critical-production-backup.ts';
import { assertCriticalBackupStructuralCoverage } from '../../scripts/db/critical-backup-reuse.ts';
import type { CommandResult } from '../../scripts/db/db-workflow-lib.ts';

jest.mock('../../scripts/db/critical-backup-reuse.ts', () => ({
	CRITICAL_BACKUP_RPO_MS: 60_000,
	assertCriticalBackupStructuralCoverage: jest.fn(),
	formatBackupAge: () => '0s',
}));

const success: CommandResult = {
	status: 0,
	stdout: 'CRITICAL_BACKUP_MANIFEST=synthetic-manifest.json',
	stderr: '',
};
const transient: CommandResult = {
	status: 1,
	stdout: 'CRITICAL_BACKUP_FAILURE=TRANSIENT\n',
	stderr: '',
};
const unstable: CommandResult = {
	status: 1,
	stdout: 'Production changed while the critical backup set was being captured',
	stderr: '',
};

function capture(results: CommandResult[]) {
	const run = jest.fn(() => results.shift()!);
	const invoke = () =>
		ensureCriticalProductionBackup({
			prodDbUrl: 'synthetic-unused-url',
			purpose: 'standalone',
			reuseExisting: false,
			retryCommand: 'synthetic-retry',
			operationLabel: 'test',
			run,
		});
	return { run, invoke };
}

beforeEach(() => {
	jest.clearAllMocks();
	jest.mocked(assertCriticalBackupStructuralCoverage).mockReturnValue({
		covered: true,
		reason: 'covered',
		maxAgeMs: 60_000,
	});
});

it.each([
	transient,
	unstable,
	{ status: 1, stdout: 'CRITICAL_BACKUP_FAILURE=UNSTABLE\n', stderr: '' },
])('retries a classified capture once and verifies the new manifest', (failure) => {
	const { run, invoke } = capture([failure, success]);
	expect(invoke()).toMatchObject({ manifestPath: 'synthetic-manifest.json', reused: false });
	expect(run).toHaveBeenCalledTimes(2);
	expect(assertCriticalBackupStructuralCoverage).toHaveBeenCalledTimes(1);
});

it.each([
	[transient, transient],
	[unstable, transient],
	[transient, unstable],
])('shares a two-attempt cap across transient and unstable failures', (...failures) => {
	const { run, invoke } = capture(failures);
	expect(invoke).toThrow();
	expect(run).toHaveBeenCalledTimes(2);
	expect(assertCriticalBackupStructuralCoverage).not.toHaveBeenCalled();
});

it.each([
	'permission denied',
	'authentication failed',
	'checksum mismatch',
	'unclassified failure',
])('does not retry %s', (stderr) => {
	const { run, invoke } = capture([{ status: 1, stdout: '', stderr }]);
	expect(invoke).toThrow();
	expect(run).toHaveBeenCalledTimes(1);
});

it('does not retry or accept a successful capture without a manifest', () => {
	const { run, invoke } = capture([{ status: 0, stdout: '', stderr: '' }]);
	expect(invoke).toThrow();
	expect(run).toHaveBeenCalledTimes(1);
});

it('rejects unverifiable coverage after a transient retry without a third capture', () => {
	jest.mocked(assertCriticalBackupStructuralCoverage).mockReturnValue({
		covered: false,
		reason: 'artifact_invalid',
		maxAgeMs: 60_000,
	});
	const { run, invoke } = capture([transient, success]);
	expect(invoke).toThrow();
	expect(run).toHaveBeenCalledTimes(2);
});
