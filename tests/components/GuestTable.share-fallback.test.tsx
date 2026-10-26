import { useState } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import GuestTable from '@/components/dashboard/guests/GuestTable';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { makeGuest } from '@tests/helpers/guest-factory';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

jest.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
// Every hand-off fails: no WhatsApp window, no native share, no clipboard.
jest.mock('@/components/dashboard/guests/invitation-share', () => ({
	...jest.requireActual('@/components/dashboard/guests/invitation-share'),
	shareInvitationLink: jest.fn().mockResolvedValue('failed'),
}));
jest.mock('@/utils/clipboard', () => ({ copyToClipboard: jest.fn().mockResolvedValue(false) }));

/** Mirrors the dashboard: marking as sent updates the guest optimistically. */
const StatefulTable = () => {
	const [items, setItems] = useState<DashboardGuestItem[]>([
		makeGuest({ guestId: 'a', fullName: 'Carlos', deliveryStatus: 'generated' }),
		makeGuest({ guestId: 'b', fullName: 'Familia López', deliveryStatus: 'shared' }),
	]);
	const onMarkShared = async (item: DashboardGuestItem) =>
		setItems((prev) =>
			prev.map((guest) =>
				guest.guestId === item.guestId
					? { ...guest, deliveryStatus: 'shared', firstSharedAt: '2026-10-01T00:00:00Z' }
					: guest,
			),
		);
	return (
		<GuestTable
			items={items}
			inviteBaseUrl="https://example.com"
			eventTitle="XV de Mía"
			shareTemplates={{
				invitation: 'Invitación {inviteUrl}',
				reminder: 'Recordatorio {inviteUrl}',
			}}
			shareDateContext={defaultShareDateContext()}
			onMarkShared={onMarkShared}
			onOpenDetails={jest.fn()}
		/>
	);
};

describe('GuestTable — invitation fallback after an optimistic status change', () => {
	beforeEach(() => {
		jest.spyOn(window, 'open').mockReturnValue(null);
	});

	afterEach(() => jest.restoreAllMocks());

	it('keeps the first-invitation fallback actions once the guest is marked as sent', async () => {
		render(<StatefulTable />);

		act(() => screen.getByRole('button', { name: 'Compartir invitación' }).click());
		const dialog = screen.getByRole('dialog');
		await act(async () =>
			within(dialog)
				.getByRole('button', { name: /^Compartir (por WhatsApp|invitación)$/ })
				.click(),
		);

		const fallback = screen.getByRole('dialog');
		expect(
			within(fallback).getByRole('button', { name: 'Copiar invitación' }),
		).toBeInTheDocument();
		expect(
			within(fallback).getByRole('button', { name: 'Copiar y marcar como enviada' }),
		).toBeInTheDocument();
		expect(
			within(fallback).getByRole('button', { name: 'Mantener pendiente' }),
		).toBeInTheDocument();
		expect(
			within(fallback).queryByRole('button', { name: 'Copiar recordatorio' }),
		).not.toBeInTheDocument();
	});
});
