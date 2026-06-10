import { render, screen, fireEvent } from '@testing-library/react';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';

function makeGuest(overrides: Partial<DashboardGuestItem> = {}): DashboardGuestItem {
	return {
		guestId: 'guest-1',
		inviteId: 'invite-1',
		fullName: 'Test Guest',
		phone: '6691234567',
		countryCode: '+52',
		maxAllowedAttendees: 4,
		attendanceStatus: 'pending',
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated',
		firstSharedAt: null,
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		respondedAt: null,
		waShareUrl: 'https://wa.me/526691234567?text=test',
		shareText: 'Share text',
		updatedAt: new Date().toISOString(),
		entrySource: 'dashboard',
		tags: [],
		eventType: 'xv',
		eventSlug: 'test-slug',
		shortId: 'ABC123',
		...overrides,
	};
}

const defaultTemplates: ShareMessagesConfig = {
	invitation: 'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}',
	reminder:
		'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}',
};

describe('ShareAction', () => {
	let onShared: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		onShared = jest.fn().mockResolvedValue(undefined);
	});

	it('renders with CTA label based on guest state (not shared)', () => {
		render(
			<ShareAction
				guest={makeGuest({ deliveryStatus: 'generated' })}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={{
					eventDate: '',
					daysUntilEvent: '',
					rsvpDeadline: '',
					eventTimingText: '',
					rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
				}}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Compartir invitación')).toBeInTheDocument();
	});

	it('renders with "Reenviar invitación" when shared but not viewed', () => {
		render(
			<ShareAction
				guest={makeGuest({ deliveryStatus: 'shared', isViewed: false })}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={{
					eventDate: '',
					daysUntilEvent: '',
					rsvpDeadline: '',
					eventTimingText: '',
					rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
				}}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Reenviar invitación')).toBeInTheDocument();
	});

	it('renders with "Enviar recordatorio" when viewed but not confirmed', () => {
		render(
			<ShareAction
				guest={makeGuest({
					deliveryStatus: 'shared',
					isViewed: true,
					attendanceStatus: 'pending',
				})}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={{
					eventDate: '',
					daysUntilEvent: '',
					rsvpDeadline: '',
					eventTimingText: '',
					rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
				}}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Enviar recordatorio')).toBeInTheDocument();
	});

	it('renders with "Compartir de nuevo" for confirmed guests', () => {
		render(
			<ShareAction
				guest={makeGuest({ attendanceStatus: 'confirmed' })}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={{
					eventDate: '',
					daysUntilEvent: '',
					rsvpDeadline: '',
					eventTimingText: '',
					rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
				}}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Compartir de nuevo')).toBeInTheDocument();
	});

	it('renders with "Compartir de nuevo" for declined guests', () => {
		render(
			<ShareAction
				guest={makeGuest({ attendanceStatus: 'declined' })}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={{
					eventDate: '',
					daysUntilEvent: '',
					rsvpDeadline: '',
					eventTimingText: '',
					rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
				}}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Compartir de nuevo')).toBeInTheDocument();
	});

	it('opens composer on click', () => {
		render(
			<ShareAction
				guest={makeGuest()}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={{
					eventDate: '',
					daysUntilEvent: '',
					rsvpDeadline: '',
					eventTimingText: '',
					rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
				}}
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(screen.getByRole('dialog', { name: /compartir/i })).toBeInTheDocument();
	});

	it('composer shows invitation and reminder toggle', () => {
		render(
			<ShareAction
				guest={makeGuest()}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={{
					eventDate: '',
					daysUntilEvent: '',
					rsvpDeadline: '',
					eventTimingText: '',
					rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
				}}
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(screen.getByText('Invitación')).toBeInTheDocument();
		expect(screen.getByText('Recordatorio')).toBeInTheDocument();
	});
});
