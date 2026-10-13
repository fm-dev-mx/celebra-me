jest.mock('@/lib/dashboard/engagement-ranking-api', () => {
	class EngagementRankingRequestError extends Error {
		readonly status: number | null;
		constructor(status: number | null) {
			super('engagement_ranking_request_failed');
			this.status = status;
		}
	}
	return {
		EngagementRankingRequestError,
		engagementRankingApi: { ranking: jest.fn() },
	};
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EngagementRankingPanel from '@/components/dashboard/engagement/EngagementRankingPanel';
import type {
	EngagementRankingReport,
	RankingInvitation,
} from '@/interfaces/dashboard/engagement-ranking.interface';
import {
	engagementRankingApi,
	EngagementRankingRequestError,
} from '@/lib/dashboard/engagement-ranking-api';

const mockRanking = engagementRankingApi.ranking as jest.MockedFunction<
	typeof engagementRankingApi.ranking
>;

function invitation(overrides: Partial<RankingInvitation>): RankingInvitation {
	return {
		eventId: 'event-1',
		invitationProjectId: null,
		title: 'Daniela y Martín',
		slug: 'daniela-y-martin',
		eventDate: '2026-11-21',
		eventDeleted: false,
		snapshotKind: 'rolling',
		computedAt: '2026-10-13T10:43:00Z',
		guestsTotal: 60,
		guestsShared: 50,
		guestsOpened: 40,
		guestsResponded: 25,
		opensTotal: 90,
		openRate: 0.8,
		completionRate: 0.55,
		rsvpConversion: 0.625,
		reopenRatio: 2.25,
		medianSecondsToOpen: 1800,
		medianSecondsToRespond: 7200,
		mobileShare: 0.9,
		shareLeadDays: 21,
		reminderCoverage: 0.4,
		groupValue: 'editorial',
		sampleState: 'eligible',
		rank: 1,
		...overrides,
	};
}

const REPORT: EngagementRankingReport = {
	eventType: 'xv',
	groupKey: 'themePreset',
	metric: 'rsvpConversion',
	since: '2026-10-12',
	thresholds: { sharedGuests: 20, groupInvitations: 5 },
	designs: [
		{
			groupValue: 'editorial',
			invitations: 2,
			eligibleInvitations: 1,
			openRate: 0.8,
			completionRate: 0.55,
			rsvpConversion: 0.625,
			medianSecondsToRespond: 7200,
			shareLeadDays: 21,
			reminderCoverage: 0.4,
			rank: null,
		},
	],
	invitations: [
		invitation({}),
		invitation({
			eventId: 'event-2',
			title: 'Muestra pequeña',
			slug: 'muestra',
			guestsShared: 4,
			sampleState: 'insufficient',
			rank: null,
			openRate: null,
		}),
	],
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('EngagementRankingPanel', () => {
	it('loads the default filters and renders designs and invitations', async () => {
		mockRanking.mockResolvedValue(REPORT);

		render(<EngagementRankingPanel />);

		expect(await screen.findByRole('heading', { name: 'Diseños' })).toBeInTheDocument();
		expect(mockRanking).toHaveBeenCalledWith({
			eventType: 'xv',
			groupBy: 'themePreset',
			metric: 'rsvpConversion',
		});
		expect(screen.getByRole('rowheader', { name: /Daniela y Martín/ })).toBeInTheDocument();
		expect(screen.getAllByText('62.5 %').length).toBeGreaterThan(0);
		expect(screen.getAllByText('2 h').length).toBeGreaterThan(0);
	});

	it('greys insufficient samples and unranked groups with the reason', async () => {
		mockRanking.mockResolvedValue(REPORT);

		render(<EngagementRankingPanel />);

		const small = await screen.findByRole('rowheader', { name: /Muestra pequeña/ });
		const row = small.closest('tr');
		expect(row).toHaveClass('engagement-ranking__row--muted');
		expect(row).toHaveAttribute('title', expect.stringContaining('menos de 20 invitados'));
		const group = screen.getByRole('rowheader', { name: 'editorial' }).closest('tr');
		expect(group).toHaveAttribute('title', expect.stringContaining('menos de 5 invitaciones'));
	});

	it('reloads when a filter changes', async () => {
		mockRanking.mockResolvedValue(REPORT);

		render(<EngagementRankingPanel />);
		await screen.findByRole('heading', { name: 'Diseños' });

		fireEvent.change(screen.getByLabelText('Tipo de evento'), { target: { value: 'boda' } });

		await waitFor(() =>
			expect(mockRanking).toHaveBeenLastCalledWith(
				expect.objectContaining({ eventType: 'boda' }),
			),
		);
	});

	it('explains an empty result and an unavailable routine', async () => {
		mockRanking.mockResolvedValueOnce({ ...REPORT, designs: [], invitations: [] });
		const { unmount } = render(<EngagementRankingPanel />);
		expect(
			await screen.findByText(
				'Aún no hay invitaciones de este tipo con datos de engagement.',
			),
		).toBeInTheDocument();
		unmount();

		mockRanking.mockRejectedValueOnce(new EngagementRankingRequestError(503));
		render(<EngagementRankingPanel />);
		expect(
			await screen.findByText('El ranking todavía no está disponible en este entorno.'),
		).toBeInTheDocument();
	});
});
