import { runEngagementMaintenance } from '@/lib/rsvp/engagement/engagement-maintenance.service';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	anonymizeGuestEngagementEventsRpc,
	computeInvitationEngagementSnapshotRpc,
	listEngagementSnapshotCandidatesRpc,
} from '@/lib/rsvp/repositories/engagement.repository';

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
}));
jest.mock('@/lib/rsvp/repositories/engagement.repository', () => ({
	listEngagementSnapshotCandidatesRpc: jest.fn(),
	computeInvitationEngagementSnapshotRpc: jest.fn(),
	anonymizeGuestEngagementEventsRpc: jest.fn(),
}));

const candidatesMock = listEngagementSnapshotCandidatesRpc as jest.Mock;
const computeMock = computeInvitationEngagementSnapshotRpc as jest.Mock;
const anonymizeMock = anonymizeGuestEngagementEventsRpc as jest.Mock;
const publishedMock = findPublishedByInvitationId as jest.Mock;

describe('engagement maintenance', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		publishedMock.mockResolvedValue({ content: { theme: { preset: 'jewelry-box' } } });
		computeMock.mockResolvedValue({ status: 'ok' });
		anonymizeMock.mockResolvedValue(0);
	});

	it('snapshots before anonymizing and passes design attributes', async () => {
		const order: string[] = [];
		candidatesMock.mockResolvedValue([
			{ event_id: 'e1', invitation_project_id: 'p1', snapshot_kind: 'rolling' },
			{ event_id: 'e1', invitation_project_id: 'p1', snapshot_kind: 'final' },
		]);
		computeMock.mockImplementation(async (_id: string, kind: string) => {
			order.push(`snapshot:${kind}`);
			return { status: kind === 'final' ? 'unchanged' : 'ok' };
		});
		anonymizeMock.mockImplementation(async () => {
			order.push('anonymize');
			return 3;
		});

		const result = await runEngagementMaintenance();

		expect(order).toEqual(['snapshot:rolling', 'snapshot:final', 'anonymize']);
		expect(computeMock).toHaveBeenCalledWith(
			'e1',
			'rolling',
			expect.objectContaining({ themePreset: 'jewelry-box' }),
			1,
		);
		expect(result).toEqual({
			snapshotsWritten: 1,
			snapshotsUnchanged: 1,
			snapshotsFailed: 0,
			anonymizedEvents: 3,
			anonymizationComplete: true,
		});
	});

	it('keeps going when one snapshot fails and stores snapshots without design when needed', async () => {
		candidatesMock.mockResolvedValue([
			{ event_id: 'e1', invitation_project_id: null, snapshot_kind: 'rolling' },
			{ event_id: 'e2', invitation_project_id: 'p2', snapshot_kind: 'rolling' },
		]);
		computeMock.mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce({ status: 'ok' });
		publishedMock.mockRejectedValue(new Error('content down'));

		const result = await runEngagementMaintenance();

		expect(computeMock).toHaveBeenNthCalledWith(2, 'e2', 'rolling', null, null);
		expect(result.snapshotsFailed).toBe(1);
		expect(result.snapshotsWritten).toBe(1);
	});

	it('anonymizes in bounded batches', async () => {
		candidatesMock.mockResolvedValue([]);
		anonymizeMock.mockResolvedValue(1000);
		const result = await runEngagementMaintenance();
		expect(anonymizeMock).toHaveBeenCalledTimes(20);
		expect(result.anonymizationComplete).toBe(false);
		expect(result.anonymizedEvents).toBe(20000);
	});
});
