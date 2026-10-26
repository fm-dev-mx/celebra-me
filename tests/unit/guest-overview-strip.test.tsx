import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import GuestOverviewStrip from '@/components/dashboard/guests/GuestOverviewStrip';
import { GuestNextStep } from '@/components/dashboard/guests/GuestStatusOverview';
import { computeGuestSummary } from '@/components/dashboard/guests/guest-presenter';
import {
	GUEST_SUMMARY_EXPANDED_STORAGE_KEY,
	useGuestSummaryExpanded,
} from '@/components/dashboard/guests/use-guest-summary-expanded';
import { makeGuest } from '@tests/helpers/guest-factory';

const summary = computeGuestSummary([
	makeGuest({ guestId: 'a', deliveryStatus: 'generated', maxAllowedAttendees: 2 }),
	makeGuest({ guestId: 'b', deliveryStatus: 'shared', maxAllowedAttendees: 3 }),
	makeGuest({
		guestId: 'c',
		deliveryStatus: 'shared',
		attendanceStatus: 'confirmed',
		maxAllowedAttendees: 4,
		attendeeCount: 3,
	}),
	makeGuest({
		guestId: 'd',
		deliveryStatus: 'shared',
		attendanceStatus: 'declined',
		maxAllowedAttendees: 2,
	}),
]);

function renderStrip(overrides: Partial<React.ComponentProps<typeof GuestOverviewStrip>> = {}) {
	const props = {
		summary,
		activeFilter: 'all' as const,
		onFilterChange: jest.fn(),
		expanded: false,
		onToggleExpanded: jest.fn(),
		fullSummaryId: 'guest-summary-full',
		...overrides,
	};
	render(<GuestOverviewStrip {...props} />);
	return props;
}

describe('GuestOverviewStrip', () => {
	it('leads with confirmed passes and the share of assigned passes', () => {
		renderStrip();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText(/de 11 pases confirmados · 27 %/)).toBeInTheDocument();
	});

	it('shows one pill per state and toggles its list filter', () => {
		const { onFilterChange } = renderStrip();
		const group = screen.getByRole('group', { name: 'Filtrar invitaciones por estado' });
		expect(group).toHaveTextContent('1 por enviar');
		expect(group).toHaveTextContent('1 sin responder');
		expect(group).toHaveTextContent('1 confirmada');
		expect(group).toHaveTextContent('1 no asistirán');

		fireEvent.click(screen.getByRole('button', { name: '1 sin responder' }));
		expect(onFilterChange).toHaveBeenCalledWith('confirmation-pending');
	});

	it('clears an active pill and keeps it visible even at zero', () => {
		const onlyUnsent = computeGuestSummary([
			makeGuest({ guestId: 'a', deliveryStatus: 'generated', maxAllowedAttendees: 2 }),
		]);
		const { onFilterChange } = renderStrip({
			summary: onlyUnsent,
			activeFilter: 'declined',
		});
		const declined = screen.getByRole('button', { name: '0 no asistirán' });
		expect(declined).toHaveAttribute('aria-pressed', 'true');
		expect(screen.queryByRole('button', { name: /confirmada/ })).not.toBeInTheDocument();

		fireEvent.click(declined);
		expect(onFilterChange).toHaveBeenCalledWith('all');
	});

	it('names the full summary toggle by its state', () => {
		const { onToggleExpanded } = renderStrip();
		const toggle = screen.getByRole('button', { name: 'Ver resumen completo' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(toggle).toHaveAttribute('aria-controls', 'guest-summary-full');
		fireEvent.click(toggle);
		expect(onToggleExpanded).toHaveBeenCalled();
	});

	it('offers to hide the summary once it is open', () => {
		renderStrip({ expanded: true });
		expect(screen.getByRole('button', { name: 'Ocultar resumen completo' })).toHaveAttribute(
			'aria-expanded',
			'true',
		);
	});
});

describe('GuestNextStep placement', () => {
	it('marks where the step renders so compact screens show only one copy', () => {
		const { container } = render(
			<GuestNextStep
				placement="strip"
				summary={summary}
				reminderCount={0}
				reminderHint={null}
				onSendPending={jest.fn()}
			/>,
		);
		expect(container.firstChild).toHaveClass('guest-overview__next--strip');
	});
});

describe('useGuestSummaryExpanded', () => {
	beforeEach(() => window.localStorage.clear());

	it('starts collapsed so the list leads', () => {
		const { result } = renderHook(() => useGuestSummaryExpanded());
		expect(result.current[0]).toBe(false);
	});

	it('remembers the choice for the next visit', () => {
		const { result } = renderHook(() => useGuestSummaryExpanded());
		act(() => result.current[1](true));
		expect(window.localStorage.getItem(GUEST_SUMMARY_EXPANDED_STORAGE_KEY)).toBe('true');

		const { result: next } = renderHook(() => useGuestSummaryExpanded());
		expect(next.current[0]).toBe(true);
	});
});
