import { render, screen } from '@testing-library/react';
import GuestEngagementFunnel from '@/components/dashboard/guests/GuestEngagementFunnel';
import {
	formatEngagementDuration,
	formatGuestOpens,
	getGuestStage,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardEngagementSummary } from '@/interfaces/dashboard/guest.interface';
import { makeGuest } from '@tests/helpers/guest-factory';

const summary: DashboardEngagementSummary = {
	guests: 12,
	shared: 10,
	previewed: 8,
	opened: 7,
	formViewed: 5,
	formStarted: 4,
	responded: 3,
	openedNotResponded: 4,
	medianSecondsToOpen: 7200,
	trackingStartedAt: '2026-10-10T12:00:00Z',
};

describe('GuestEngagementFunnel', () => {
	it('shows each step as a count and a share of sent invitations', () => {
		render(<GuestEngagementFunnel summary={summary} />);
		expect(
			screen.getByRole('heading', { name: 'Interacción de sus invitados' }),
		).toBeInTheDocument();
		const steps = screen.getAllByRole('listitem').map((item) => item.textContent);
		expect(steps).toEqual([
			'Enviadas10 · 100 %',
			'Abiertas7 · 70 %',
			'Llegaron al formulario5 · 50 %',
			'Empezaron a responder4 · 40 %',
			'Respondieron3 · 30 %',
		]);
		expect(
			screen.getByText('8 invitaciones se mostraron como vista previa en el chat.'),
		).toBeInTheDocument();
		expect(
			screen.getByText('La mitad de sus invitados abre en menos de 2 h después del envío.'),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Datos desde el .*No incluye invitados de prueba\./),
		).toBeInTheDocument();
	});

	it('renders nothing before any invitation was sent', () => {
		const { container } = render(<GuestEngagementFunnel summary={{ ...summary, shared: 0 }} />);
		expect(container).toBeEmptyDOMElement();
	});
});

describe('guest engagement presentation', () => {
	it('counts engagement opens toward the opened stage', () => {
		expect(getGuestStage(makeGuest({ deliveryStatus: 'shared', openCount: 2 }))).toBe('opened');
		expect(getGuestStage(makeGuest({ deliveryStatus: 'shared', openCount: 0 }))).toBe(
			'unopened',
		);
	});

	it('formats opens with the legacy first-view fallback', () => {
		expect(formatGuestOpens(makeGuest({ openCount: 1 }))).toBe('1 vez');
		expect(
			formatGuestOpens(makeGuest({ openCount: 3, lastOpenedAt: '2026-10-09T18:00:00Z' })),
		).toMatch(/^3 veces · última el /);
		expect(formatGuestOpens(makeGuest({ openCount: 0, firstViewedAt: null }))).toBeNull();
	});

	it('formats funnel durations', () => {
		expect(formatEngagementDuration(30)).toBe('1 min');
		expect(formatEngagementDuration(45 * 60)).toBe('45 min');
		expect(formatEngagementDuration(5 * 3600)).toBe('5 h');
		expect(formatEngagementDuration(3 * 86400)).toBe('3 días');
	});
});
