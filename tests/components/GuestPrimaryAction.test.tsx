import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GuestPrimaryAction from '@/components/dashboard/guests/GuestPrimaryAction';
import { makeGuest } from '@tests/helpers/guest-factory';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

jest.mock('@/components/dashboard/guests/ShareAction', () => ({
	__esModule: true,
	default: () => <div data-testid="share-action" />,
}));

const SHARE_TEMPLATES = {
	invitation: 'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}',
	reminder: 'Hola {guestName},\n\n{eventTimingText}\n\n{inviteUrl}',
};

/** Mirrors the dashboard: sending a reminder removes the guest from the eligible set. */
function ReminderHarness() {
	const [eligible, setEligible] = useState(true);
	return (
		<GuestPrimaryAction
			item={makeGuest({ guestId: 'guest-1', phone: '1000000001', deliveryStatus: 'shared' })}
			inviteUrl="http://localhost/invitacion/invite-1"
			eventTitle="Test Event"
			shareTemplates={SHARE_TEMPLATES}
			shareDateContext={defaultShareDateContext()}
			reminderMode
			isReminderEligible={eligible}
			onReminderSent={() => setEligible(false)}
			onMarkShared={jest.fn().mockResolvedValue(undefined)}
		/>
	);
}

describe('GuestPrimaryAction', () => {
	beforeEach(() => {
		window.open = jest.fn().mockReturnValue(null);
		const nav = navigator as unknown as Record<string, unknown>;
		delete nav.share;
		delete nav.clipboard;
	});

	it('keeps the reminder fallback open when sending removes the guest from the eligible set', async () => {
		render(<ReminderHarness />);

		fireEvent.click(screen.getByRole('button', { name: 'Enviar recordatorio a Guest One' }));
		const dialog = screen.getByRole('dialog');
		fireEvent.click(within(dialog).getByRole('button', { name: /^enviar recordatorio/i }));

		await waitFor(() => expect(screen.getByTestId('share-action')).toBeInTheDocument());
		expect(await screen.findByText('Copiar recordatorio')).toBeInTheDocument();
	});
});
