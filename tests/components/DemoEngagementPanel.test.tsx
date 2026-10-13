jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: { get: jest.fn() },
}));

jest.mock('@/lib/dashboard/engagement-ranking-api', () => {
	const actual = jest.requireActual('@/lib/dashboard/engagement-ranking-api');
	return { ...actual, engagementRankingApi: { ranking: jest.fn(() => new Promise(() => {})) } };
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EngagementRankingPanel from '@/components/dashboard/engagement/EngagementRankingPanel';
import type { DemoEngagementReport } from '@/interfaces/dashboard/demo-engagement.interface';
import { dashboardApi } from '@/lib/dashboard/api-client';

const mockGet = dashboardApi.get as jest.MockedFunction<typeof dashboardApi.get>;

const REPORT: DemoEngagementReport = {
	period: 30,
	eventType: 'all',
	sort: 'reach100',
	minSessions: 100,
	since: '2026-06-29',
	demos: [
		{
			slug: 'demo-xv-celestial-blue',
			title: 'Celestial Blue',
			eventType: 'xv',
			themePreset: 'celestial-blue',
			listed: true,
			sessions: 420,
			reach50: 0.62,
			reach75: 0.41,
			reach100: 0.18,
			bounce: 0.21,
			largestDrop: { from: 25, to: 50, share: 0.21 },
			contactSessions: 3,
			contactsPer100: 0.71,
			sampleState: 'eligible',
			rank: 1,
		},
		{
			slug: 'demo-xv-old',
			title: 'demo-xv-old',
			eventType: 'xv',
			themePreset: null,
			listed: false,
			sessions: 12,
			reach50: 0.5,
			reach75: 0.25,
			reach100: 0.08,
			bounce: 0.25,
			largestDrop: { from: 50, to: 75, share: 0.25 },
			contactSessions: 0,
			contactsPer100: 0,
			sampleState: 'insufficient',
			rank: null,
		},
	],
};

beforeEach(() => {
	jest.clearAllMocks();
	window.history.replaceState(null, '', '/dashboard/admin/ranking');
	mockGet.mockResolvedValue({ ok: true, status: 200, data: { demos: REPORT } } as never);
});

describe('Demos tab', () => {
	it('opens from its tab, reads demo retention and keeps the tab in the URL', async () => {
		render(<EngagementRankingPanel />);

		fireEvent.click(screen.getByRole('tab', { name: 'Demos' }));

		expect(
			await screen.findByRole('rowheader', { name: /Celestial Blue/ }),
		).toBeInTheDocument();
		expect(mockGet).toHaveBeenCalledWith(
			'/api/dashboard/admin/engagement/demos?period=30&eventType=all&sort=reach100',
		);
		expect(window.location.search).toBe('?tab=demos');
		const row = screen.getByRole('rowheader', { name: /Celestial Blue/ }).closest('tr')!;
		expect(within(row).getByText('18 %')).toBeInTheDocument();
		expect(within(row).getByText('25–50 % (21 %)')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Ver embudo comercial/ })).toHaveAttribute(
			'href',
			'/dashboard/commercial',
		);
	});

	it('greys small samples and tags retired demos', async () => {
		window.history.replaceState(null, '', '/dashboard/admin/ranking?tab=demos');
		render(<EngagementRankingPanel />);

		const old = (await screen.findByRole('rowheader', { name: /demo-xv-old/ })).closest('tr')!;
		expect(old).toHaveClass('engagement-ranking__row--muted');
		expect(within(old).getByText('Retirada')).toBeInTheDocument();
	});

	it('reloads with the selected period and sort', async () => {
		window.history.replaceState(null, '', '/dashboard/admin/ranking?tab=demos');
		render(<EngagementRankingPanel />);
		await screen.findByRole('rowheader', { name: /Celestial Blue/ });

		fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: '60' } });
		fireEvent.change(screen.getByLabelText('Ordenar por'), {
			target: { value: 'contactsPer100' },
		});

		await waitFor(() =>
			expect(mockGet).toHaveBeenLastCalledWith(
				'/api/dashboard/admin/engagement/demos?period=60&eventType=all&sort=contactsPer100',
			),
		);
	});
});
