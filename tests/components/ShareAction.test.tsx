import { render, screen, fireEvent } from '@testing-library/react';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import { makeGuest } from '@tests/helpers/guest-factory';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

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
				shareDateContext={defaultShareDateContext()}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Compartir invitación')).toBeInTheDocument();
	});

	it('renders with "Enviar recordatorio" when shared but not viewed', () => {
		render(
			<ShareAction
				guest={makeGuest({
					deliveryStatus: 'shared',
					firstSharedAt: '2026-01-15T10:00:00.000Z',
					isViewed: false,
				})}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={defaultShareDateContext()}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Enviar recordatorio')).toBeInTheDocument();
	});

	it('renders with "Enviar recordatorio" when viewed but not confirmed', () => {
		render(
			<ShareAction
				guest={makeGuest({
					deliveryStatus: 'shared',
					firstSharedAt: '2026-01-15T10:00:00.000Z',
					isViewed: true,
					attendanceStatus: 'pending',
				})}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={defaultShareDateContext()}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Enviar recordatorio')).toBeInTheDocument();
	});

	it('renders with "Compartir invitación" for confirmed guests with generated deliveryStatus even if firstSharedAt is set', () => {
		render(
			<ShareAction
				guest={makeGuest({
					deliveryStatus: 'generated',
					attendanceStatus: 'confirmed',
					firstSharedAt: '2026-01-15T10:00:00.000Z',
				})}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={defaultShareDateContext()}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Compartir invitación')).toBeInTheDocument();
	});

	it('renders with "Compartir invitación" for declined guests without firstSharedAt', () => {
		render(
			<ShareAction
				guest={makeGuest({ attendanceStatus: 'declined', firstSharedAt: null })}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={defaultShareDateContext()}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Compartir invitación')).toBeInTheDocument();
	});

	it('opens composer on click', () => {
		render(
			<ShareAction
				guest={makeGuest()}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={defaultShareDateContext()}
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(screen.getByRole('dialog', { name: /compartir/i })).toBeInTheDocument();
	});

	it('composer shows send invitation modal with guest name and message preview', () => {
		render(
			<ShareAction
				guest={makeGuest()}
				inviteUrl="https://example.com/invite"
				eventTitle="Test Event"
				shareTemplates={defaultTemplates}
				shareDateContext={defaultShareDateContext()}
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(screen.getByRole('dialog', { name: /compartir invitación/i })).toBeInTheDocument();
		expect(screen.getByDisplayValue('Guest One')).toBeInTheDocument();
		expect(screen.getByText('Mensaje')).toBeInTheDocument();
	});
});
