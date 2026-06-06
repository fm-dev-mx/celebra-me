import { buildDemoDriftReport } from '@/lib/content-publication/demo-drift';
import { confirmDemoPublish, dryRunDemoPublish } from '@/lib/content-publication/demo-publish';
import { hashContent } from '@/lib/content-publication/hash-content';
import {
	findPublishedBySlugAndEventType,
	updatePublishedContentSnapshot,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import demoJson from '@/content/event-demos/xv/demo-xv-jewelry-box.json';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedBySlugAndEventType: jest.fn(),
	updatePublishedContentSnapshot: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/audit-logger.service', () => ({
	logAdminAction: jest.fn(),
}));

const demoContent = demoJson as Record<string, unknown>;
let validatedDemoContent: Record<string, unknown>;

const prodRow = {
	id: 'pub-1',
	invitationId: 'demo-invitation-1',
	slug: 'demo-xv-jewelry-box',
	eventType: 'xv',
	isDemo: true,
	content: demoContent,
	version: 2,
	publishedAt: '2026-06-01T00:00:00.000Z',
	createdAt: '2026-05-01T00:00:00.000Z',
	updatedAt: '2026-06-01T00:00:00.000Z',
};

beforeAll(() => {
	validatedDemoContent = eventContentSchema.parse(demoJson) as Record<string, unknown>;
});

const findPublishedMock = findPublishedBySlugAndEventType as jest.MockedFunction<
	typeof findPublishedBySlugAndEventType
>;
const updatePublishedSnapshotMock = updatePublishedContentSnapshot as jest.MockedFunction<
	typeof updatePublishedContentSnapshot
>;
const logAdminActionMock = logAdminAction as jest.MockedFunction<typeof logAdminAction>;

describe('demo content publication service', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('matches drift by event_type and slug', async () => {
		const localContent = {
			'xv/demo-xv-jewelry-box': demoContent,
		};
		const prodRows = [
			{ ...prodRow, eventType: 'boda', slug: 'demo-xv-jewelry-box' },
			{ ...prodRow, content: { ...demoContent, title: 'Old Demo' } },
		];

		const report = await buildDemoDriftReport({
			loadLocalDemos: async () => localContent,
			loadPublishedRows: async () => prodRows,
			sourceEnvironment: 'local',
		});

		const item = report.items.find((entry) => entry.route_key === 'xv/demo-xv-jewelry-box');
		expect(item?.published_row_id).toBe('pub-1');
		expect(item?.status).toBe('different');
		expect(item?.changed_paths).toContain('title');
		expect(report.items.some((entry) => entry.route_key === 'boda/demo-xv-jewelry-box')).toBe(
			true,
		);
	});

	it('dry-run does not mutate published content', async () => {
		findPublishedMock.mockResolvedValue({
			...prodRow,
			content: { ...demoContent, title: 'Old Demo' },
		});

		const result = await dryRunDemoPublish({
			eventType: 'xv',
			slug: 'demo-xv-jewelry-box',
			loadLocalDemo: async () => demoContent,
		});

		expect(result.can_publish).toBe(true);
		expect(result.status).toBe('different');
		expect(updatePublishedSnapshotMock).not.toHaveBeenCalled();
	});

	it('confirmed publish refuses non-demo production rows', async () => {
		findPublishedMock.mockResolvedValue({ ...prodRow, isDemo: false });

		await expect(
			confirmDemoPublish({
				eventType: 'xv',
				slug: 'demo-xv-jewelry-box',
				expectedProdHash: hashContent(prodRow.content),
				actorUserId: 'admin-1',
				loadLocalDemo: async () => demoContent,
			}),
		).rejects.toMatchObject({ status: 409, code: 'unsafe_target' });

		expect(updatePublishedSnapshotMock).not.toHaveBeenCalled();
		expect(logAdminActionMock).not.toHaveBeenCalled();
	});

	it('confirmed publish refuses stale expected production hash', async () => {
		findPublishedMock.mockResolvedValue({
			...prodRow,
			content: { ...demoContent, title: 'Changed in production' },
		});

		await expect(
			confirmDemoPublish({
				eventType: 'xv',
				slug: 'demo-xv-jewelry-box',
				expectedProdHash: hashContent(prodRow.content),
				actorUserId: 'admin-1',
				loadLocalDemo: async () => demoContent,
			}),
		).rejects.toMatchObject({ status: 409, code: 'stale_production_content' });

		expect(updatePublishedSnapshotMock).not.toHaveBeenCalled();
		expect(logAdminActionMock).not.toHaveBeenCalled();
	});

	it('confirmed publish writes audit backup and only sends allowed published columns through repository input', async () => {
		const before = { ...prodRow, content: { ...demoContent, title: 'Old Demo' } };
		const expectedHash = hashContent(before.content);
		findPublishedMock.mockResolvedValueOnce(before).mockResolvedValueOnce({
			...prodRow,
			version: 3,
			content: demoContent,
		});
		updatePublishedSnapshotMock.mockResolvedValue({
			...prodRow,
			version: 3,
			content: demoContent,
		});

		const result = await confirmDemoPublish({
			eventType: 'xv',
			slug: 'demo-xv-jewelry-box',
			expectedProdHash: expectedHash,
			actorUserId: 'admin-1',
			loadLocalDemo: async () => demoContent,
		});

		expect(result.published).toBe(true);
		expect(updatePublishedSnapshotMock).toHaveBeenCalledWith({
			id: 'pub-1',
			content: validatedDemoContent,
			version: 3,
			publishedAt: expect.any(String),
		});
		expect(logAdminActionMock).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: 'admin-1',
				action: 'demo_publish_backup',
				targetTable: 'published_invitation_content',
				targetId: 'pub-1',
				oldData: expect.objectContaining({
					operation: 'demo-publish',
					before,
					expected_prod_hash: expectedHash,
				}),
			}),
		);
	});
});
