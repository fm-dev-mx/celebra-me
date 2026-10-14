jest.mock('@/lib/dashboard/engagement-ranking-api', () => {
	const actual = jest.requireActual('@/lib/dashboard/engagement-ranking-api');
	return { ...actual, engagementRankingApi: { ranking: jest.fn() } };
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EngagementRankingPanel from '@/components/dashboard/engagement/EngagementRankingPanel';
import type {
	EngagementRankingReport,
	RankingInvitation,
} from '@/interfaces/dashboard/engagement-ranking.interface';
import {
	engagementRankingApi,
	EngagementRankingRequestError,
	fromRankingSearch,
	toRankingSearch,
} from '@/lib/dashboard/engagement-ranking-api';

const mockRanking = engagementRankingApi.ranking as jest.MockedFunction<
	typeof engagementRankingApi.ranking
>;

function invitation(overrides: Partial<RankingInvitation>): RankingInvitation {
	return {
		invitationId: 'inv-1',
		eventId: 'event-1',
		title: 'Daniela y Martín',
		slug: 'daniela-y-martin',
		eventType: 'boda',
		eventDate: '2026-11-28',
		eventStatus: 'upcoming',
		activityState: 'measured',
		publicAccess: 'enabled',
		confirmationMode: 'api',
		conversionMeasurability: 'full',
		themePreset: 'jewelry-box-wedding',
		personalizedAccessVariant: 'ornamented',
		rsvpAccessMode: 'hybrid',
		fontFamily: null,
		musicEnabled: false,
		snapshotKind: 'rolling',
		computedAt: '2026-10-13T10:43:00Z',
		guestsTotal: 159,
		guestsShared: 146,
		guestsResponded: 122,
		guestsRespondedSelf: 118,
		guestsOpened: 3,
		guestsOpenedInferred: 119,
		responseRate: 0.8082,
		conversionUpper: 0.9916,
		shareLeadDays: 70,
		reminderCoverage: 0.3,
		openRate: 0.02,
		completionRate: 0.5,
		reopenRatio: 1.2,
		medianSecondsToOpen: 1800,
		medianSecondsToRespond: 7200,
		mobileShare: 0.9,
		groupValue: 'jewelry-box-wedding',
		sampleState: 'eligible',
		rank: 1,
		...overrides,
	};
}

const REPORT: EngagementRankingReport = {
	eventType: 'all',
	groupKey: 'themePreset',
	metric: 'responseRate',
	filters: {},
	since: '2026-10-12',
	thresholds: { sharedGuests: 20, groupInvitations: 5 },
	facets: {
		themePreset: [{ value: 'jewelry-box-wedding', count: 2 }],
		personalizedAccessVariant: [],
		rsvpAccessMode: [],
		fontFamily: [{ value: 'serif', count: 1 }],
		confirmationMode: [
			{ value: 'api', count: 1 },
			{ value: 'whatsapp', count: 1 },
		],
	},
	totals: { listed: 2, total: 2 },
	designs: [
		{
			eventType: 'boda',
			groupValue: 'jewelry-box-wedding',
			invitations: 2,
			comparableInvitations: 1,
			responseRate: 0.8082,
			openRate: 0.02,
			completionRate: 0.5,
			conversionUpper: 0.9916,
			medianSecondsToRespond: 7200,
			shareLeadDays: 70,
			reminderCoverage: 0.3,
			rank: null,
		},
	],
	invitations: [
		invitation({}),
		invitation({
			invitationId: 'inv-2',
			eventId: 'event-2',
			title: 'Boda por WhatsApp',
			slug: 'boda-whatsapp',
			activityState: 'none',
			snapshotKind: null,
			confirmationMode: 'whatsapp',
			conversionMeasurability: 'none',
			conversionUpper: null,
			openRate: null,
			completionRate: null,
			rank: null,
		}),
	],
};

beforeEach(() => {
	jest.clearAllMocks();
	window.history.replaceState(null, '', '/dashboard/admin/ranking');
});

describe('ranking URL state', () => {
	it('round-trips a filtered request and omits defaults', () => {
		const request = {
			eventType: 'xv',
			groupBy: 'rsvpAccessMode' as const,
			metric: 'openRate' as const,
			filters: { eventStatus: 'upcoming' as const, includeDisabled: true },
		};
		const search = toRankingSearch(request);
		expect(search).toBe(
			'eventType=xv&groupBy=rsvpAccessMode&metric=openRate&eventStatus=upcoming&includeDisabled=true',
		);
		expect(fromRankingSearch(search)).toMatchObject(request);
		expect(toRankingSearch(fromRankingSearch('groupBy=templateId&metric=nope'))).toBe('');
	});
});

describe('EngagementRankingPanel', () => {
	it('loads all event types by default and labels each column with its confidence level', async () => {
		mockRanking.mockResolvedValue(REPORT);

		render(<EngagementRankingPanel />);

		expect(await screen.findByRole('heading', { name: 'Diseños' })).toBeInTheDocument();
		expect(mockRanking).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: 'all',
				groupBy: 'themePreset',
				metric: 'responseRate',
			}),
		);
		const tables = screen.getAllByRole('table');
		const invitations = tables[1]!;
		expect(
			within(invitations).getByRole('columnheader', { name: /Tasa de respuesta\s*Exacto/ }),
		).toBeInTheDocument();
		expect(
			within(invitations).getByRole('columnheader', {
				name: /Abiertas \(incl\. inferidas\)\s*Inferido/,
			}),
		).toBeInTheDocument();
		expect(
			within(invitations).getByRole('columnheader', { name: /Conversión\s*Cota/ }),
		).toBeInTheDocument();
		expect(within(invitations).getAllByRole('columnheader', { name: 'Tipo' })).toHaveLength(1);
		expect(within(invitations).getByText('≤ 99.2 %')).toBeInTheDocument();
		expect(screen.getByText('Mostrando 2 de 2')).toBeInTheDocument();
	});

	it('marks WhatsApp conversion as not measurable and invitations without activity', async () => {
		mockRanking.mockResolvedValue(REPORT);

		render(<EngagementRankingPanel />);

		const row = (await screen.findByRole('rowheader', { name: /Boda por WhatsApp/ })).closest(
			'tr',
		)!;
		expect(within(row).getByText('No medible (WhatsApp)')).toBeInTheDocument();
		expect(within(row).getByText(/Sin actividad desde el/)).toBeInTheDocument();
		expect(row).toHaveClass('engagement-ranking__row--muted');
	});

	it('applies a filter, shows it as a removable chip and keeps it in the URL', async () => {
		mockRanking.mockResolvedValue(REPORT);

		render(<EngagementRankingPanel />);
		await screen.findByRole('heading', { name: 'Diseños' });

		fireEvent.change(screen.getByLabelText('Estado del evento'), {
			target: { value: 'upcoming' },
		});

		await waitFor(() =>
			expect(mockRanking).toHaveBeenLastCalledWith(
				expect.objectContaining({
					filters: expect.objectContaining({ eventStatus: 'upcoming' }),
				}),
			),
		);
		expect(window.location.search).toBe('?eventStatus=upcoming');
		fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro: Próximas' }));
		await waitFor(() => expect(window.location.search).toBe(''));
	});

	it('offers facet values from the data in the filters', async () => {
		mockRanking.mockResolvedValue(REPORT);

		render(<EngagementRankingPanel />);
		await screen.findByRole('heading', { name: 'Diseños' });

		const confirmation = screen.getByLabelText('Modo de confirmación');
		expect(
			within(confirmation).getByRole('option', { name: 'WhatsApp (1)' }),
		).toBeInTheDocument();
		expect(
			within(screen.getByLabelText('Tipografía')).getByRole('option', { name: 'serif (1)' }),
		).toBeInTheDocument();
	});

	it('restores the view from the URL', async () => {
		window.history.replaceState(
			null,
			'',
			'/dashboard/admin/ranking?eventType=xv&activity=none',
		);
		mockRanking.mockResolvedValue({ ...REPORT, eventType: 'xv' });

		render(<EngagementRankingPanel />);

		await waitFor(() =>
			expect(mockRanking).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'xv',
					filters: expect.objectContaining({ activity: 'none' }),
				}),
			),
		);
	});

	it('explains an empty result and an unavailable routine', async () => {
		mockRanking.mockResolvedValueOnce({
			...REPORT,
			designs: [],
			invitations: [],
			totals: { listed: 0, total: 2 },
		});
		const { unmount } = render(<EngagementRankingPanel />);
		expect(
			await screen.findByText('Ninguna invitación coincide con los filtros.'),
		).toBeInTheDocument();
		unmount();

		mockRanking.mockRejectedValueOnce(new EngagementRankingRequestError(503));
		render(<EngagementRankingPanel />);
		expect(
			await screen.findByText('El ranking todavía no está disponible en este entorno.'),
		).toBeInTheDocument();
	});
});
