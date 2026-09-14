import { runPsql } from '../../scripts/db/db-workflow-lib';
import { createCloudinaryMigrationSession } from '../../scripts/provision/cloudinary-adapter';
import { CloudinaryQuotaError } from '../../scripts/provision/cloudinary-quota';
import {
	applyRemoteMigration,
	fingerprint,
	planAll,
	type LiveSnapshot,
	type MigrationPlan,
} from '../../scripts/invitation/image-namespace-migration-cli';

jest.mock('../../scripts/db/db-workflow-lib', () => ({
	...jest.requireActual('../../scripts/db/db-workflow-lib'),
	runPsql: jest.fn(),
}));
jest.mock('../../scripts/provision/cloudinary-adapter', () => ({
	...jest.requireActual('../../scripts/provision/cloudinary-adapter'),
	createCloudinaryMigrationSession: jest.fn(),
}));
jest.mock('node:fs', () => ({
	...jest.requireActual('node:fs'),
	mkdirSync: jest.fn(),
	writeFileSync: jest.fn(),
}));

const oldId = '00000000-0000-4000-8000-000000000001';
const oldPublicId = 'xv/example/assets/hero-aaaaaaaaaaaa';
const newPublicId = `preview/${oldPublicId}`;
const content = {
	hero: {
		image: {
			type: 'uploaded',
			assetId: oldId,
			src: `https://res.cloudinary.com/test/image/upload/v1/${oldPublicId}.webp`,
		},
	},
};
const snapshot: LiveSnapshot = {
	targetEnvironment: 'preview',
	invitationId: '00000000-0000-4000-8000-000000000002',
	slug: 'example',
	eventType: 'xv',
	draft: { id: '00000000-0000-4000-8000-000000000003', content },
	published: null,
	historicalContents: [],
	assets: [
		{
			id: oldId,
			key: 'hero',
			displayName: 'Hero',
			alt: '',
			publicId: oldPublicId,
			sha256: 'a'.repeat(64),
			mimeType: 'image/webp',
			width: 2,
			height: 3,
		},
	],
};
const plan: MigrationPlan = {
	schemaVersion: 1,
	planId: 'test',
	target: 'preview',
	slug: 'example',
	cloudName: 'test',
	before: snapshot,
	snapshotHash: fingerprint(snapshot),
	retirements: [],
	swaps: [
		{
			oldId,
			newId: '00000000-0000-4000-8000-000000000004',
			key: 'hero',
			oldPublicId,
			newPublicId,
			newUrl: `https://res.cloudinary.com/test/image/upload/v1/${newPublicId}.webp`,
			sha256: 'a'.repeat(64),
			mimeType: 'image/webp',
			width: 2,
			height: 3,
			providerVersion: '1',
			providerMetadata: {},
		},
	],
};

describe('namespace migration quota failure boundaries', () => {
	const originalEnv = process.env;
	let session: ReturnType<typeof createCloudinaryMigrationSession>;
	beforeEach(() => {
		jest.clearAllMocks();
		process.env = { ...originalEnv, CLOUDINARY_CLOUD_NAME: 'test' };
		session = {
			quota: {
				beginInvitation: jest.fn().mockResolvedValue(undefined),
				summary: jest.fn().mockReturnValue({}),
			},
			verifySource: jest.fn().mockResolvedValue({ bytes: new Uint8Array([1]) }),
			copy: jest.fn().mockResolvedValue({
				publicId: newPublicId,
				secureUrl: plan.swaps[0].newUrl,
				version: '1',
				metadata: {},
			}),
		} as unknown as ReturnType<typeof createCloudinaryMigrationSession>;
		jest.mocked(createCloudinaryMigrationSession).mockReturnValue(session);
		jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
	});
	afterEach(() => {
		jest.restoreAllMocks();
		process.env = originalEnv;
	});

	it('does not copy or write DB when the invitation exceeds the quota budget', async () => {
		jest.mocked(session.quota.beginInvitation).mockRejectedValue(
			new CloudinaryQuotaError('insufficient balance'),
		);
		await expect(
			applyRemoteMigration(structuredClone(plan), snapshot, 'unused'),
		).rejects.toThrow('insufficient balance');
		expect(session.verifySource).not.toHaveBeenCalled();
		expect(session.copy).not.toHaveBeenCalled();
		expect(runPsql).not.toHaveBeenCalled();
	});

	it.each([420, 429])(
		'does not update DB after HTTP %i during destination verification',
		async (status) => {
			jest.mocked(session.copy).mockRejectedValue(new CloudinaryQuotaError(`HTTP ${status}`));
			await expect(
				applyRemoteMigration(structuredClone(plan), snapshot, 'unused'),
			).rejects.toThrow(`HTTP ${status}`);
			expect(runPsql).not.toHaveBeenCalled();
		},
	);

	it('stops all remaining planning invitations on a global quota failure', async () => {
		jest.mocked(runPsql)
			.mockReturnValueOnce({ stdout: JSON.stringify(['example', 'next']) } as never)
			.mockReturnValueOnce({ stdout: JSON.stringify(snapshot) } as never);
		jest.mocked(session.verifySource).mockRejectedValue(new CloudinaryQuotaError('HTTP 420'));
		await expect(planAll('preview', '.tmp/quota-test-not-written', 'unused')).rejects.toThrow(
			'HTTP 420',
		);
		expect(runPsql).toHaveBeenCalledTimes(2);
		expect(session.quota.beginInvitation).toHaveBeenCalledTimes(1);
		expect(session.quota.beginInvitation).toHaveBeenCalledWith(1);
		expect(process.stdout.write).toHaveBeenCalledWith(
			expect.stringContaining('pending: example, next'),
		);
	});

	it('does not update DB when the snapshot changes during verified copies', async () => {
		jest.mocked(runPsql).mockReturnValue({
			stdout: JSON.stringify({
				...snapshot,
				draft: { ...snapshot.draft, content: { text: 'concurrent edit' } },
			}),
		} as never);
		await expect(
			applyRemoteMigration(structuredClone(plan), snapshot, 'unused'),
		).rejects.toThrow('Target changed');
		expect(runPsql).toHaveBeenCalledTimes(1);
		expect(String(jest.mocked(runPsql).mock.calls[0][0])).toMatch(/^select /);
	});
});
