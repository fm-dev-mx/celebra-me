jest.mock('../../scripts/provision/dbs-status.ts', () => ({ resolveDbUrlForEnv: jest.fn() }));
jest.mock('../../scripts/db/db-target-config.ts', () => ({ classifyDbTarget: jest.fn() }));
jest.mock('../../scripts/status-core/probe-runner.ts', () => ({ runPsqlAsync: jest.fn() }));

import { resolveDbUrlForEnv } from '../../scripts/provision/dbs-status';
import { classifyDbTarget } from '../../scripts/db/db-target-config';
import { runPsqlAsync } from '../../scripts/status-core/probe-runner';
import {
	buildProductionLegacyStorageSql,
	readLegacyStorageEvidence,
	previewLegacyStorageSchema,
	productionLegacyStorageSchema,
} from '../../scripts/provision/legacy-storage-audit';

beforeEach(() => jest.resetAllMocks());

it('rejects invalid IDs before constructing the Production query', () => {
	expect(() =>
		buildProductionLegacyStorageSql({
			invitations: [{ id: "'); delete from public.invitations; --" }],
			published: [],
			assets: [],
			liveSupabaseAssets: 0,
		}),
	).toThrow('INVALID_PREVIEW_ID');
});

it('counts collisions without ignoring archived or deleted Production rows', () => {
	const sql = buildProductionLegacyStorageSql({
		invitations: [],
		published: [],
		assets: [],
		liveSupabaseAssets: 0,
	});
	expect(sql).toContain('where id in (NULL)');
	expect(sql.match(/deleted_at is null/g)).toHaveLength(1);
	expect(sql).not.toContain('archived_at');
});

it('requires complete numeric evidence rather than treating unavailable data as zero', () => {
	expect(productionLegacyStorageSchema.safeParse({}).success).toBe(false);
	expect(
		previewLegacyStorageSchema.safeParse({
			invitations: [],
			published: [],
			assets: [],
			liveSupabaseAssets: 101,
		}).success,
	).toBe(false);
});

it('refuses wrong environment identity before executing SQL', async () => {
	jest.mocked(resolveDbUrlForEnv).mockReturnValue({ dbUrl: 'fake-url' });
	jest.mocked(classifyDbTarget).mockReturnValue({ target: 'production' } as ReturnType<
		typeof classifyDbTarget
	>);
	await expect(readLegacyStorageEvidence('preview', 'select 1')).rejects.toThrow(
		'IDENTITY_OR_CREDENTIALS_REQUIRED',
	);
	expect(runPsqlAsync).not.toHaveBeenCalled();
});

it('enforces an explicit read-only transaction and bounded query', async () => {
	jest.mocked(resolveDbUrlForEnv).mockReturnValue({ dbUrl: 'fake-url' });
	jest.mocked(classifyDbTarget).mockReturnValue({ target: 'preview' } as ReturnType<
		typeof classifyDbTarget
	>);
	jest.mocked(runPsqlAsync).mockResolvedValue({
		status: 0,
		stdout: 'BEGIN\n{"ok":true}\nROLLBACK\n',
		stderr: '',
	});
	await expect(readLegacyStorageEvidence('preview', 'select 1;')).resolves.toEqual({ ok: true });
	expect(runPsqlAsync).toHaveBeenCalledWith(
		'begin read only;\nselect 1;\nrollback;',
		'fake-url',
		{
			readOnly: true,
			timeoutMs: 15_000,
			tuplesOnly: true,
		},
	);
	jest.mocked(runPsqlAsync).mockResolvedValue({ status: 1, stdout: '', stderr: '' });
	await expect(readLegacyStorageEvidence('preview', 'select 1;')).rejects.toThrow('UNAVAILABLE');
});
