import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import GuestTable from '@/components/dashboard/guests/GuestTable';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { makeGuest } from '@tests/helpers/guest-factory';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

jest.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
// Stands in for the composer: marking the guest as sent happens while it stays open,
// as when the browser hand-off fails and the manual fallback is still on screen.
jest.mock('@/components/dashboard/guests/SendInvitationModal', () => ({
	__esModule: true,
	default: ({ onMarkShared, onClose }: { onMarkShared: () => void; onClose: () => void }) => (
		<div role="dialog" aria-label="Compositor">
			<button type="button" onClick={() => void onMarkShared()}>
				Registrar envío
			</button>
			<button type="button" onClick={onClose}>
				Cerrar
			</button>
		</div>
	),
}));

const initialItems = [
	makeGuest({ guestId: 'a', fullName: 'Carlos', deliveryStatus: 'generated' }),
	makeGuest({ guestId: 'b', fullName: 'Tía Carmen', deliveryStatus: 'generated' }),
	makeGuest({ guestId: 'c', fullName: 'Familia López', deliveryStatus: 'shared' }),
];

/** Mirrors the dashboard: marking as sent updates the guest optimistically. */
const StatefulTable = () => {
	const [items, setItems] = useState<DashboardGuestItem[]>(initialItems);
	const onMarkShared = async (item: DashboardGuestItem) =>
		setItems((prev) =>
			prev.map((guest) =>
				guest.guestId === item.guestId ? { ...guest, deliveryStatus: 'shared' } : guest,
			),
		);
	return (
		<GuestTable
			items={items}
			inviteBaseUrl="https://example.com"
			eventTitle="XV de Mía"
			shareTemplates={{ invitation: '{inviteUrl}', reminder: '{inviteUrl}' }}
			shareDateContext={defaultShareDateContext()}
			onMarkShared={onMarkShared}
			onOpenDetails={jest.fn()}
		/>
	);
};

const groupCounts = () =>
	screen.getAllByRole('button', { expanded: true }).map((button) => button.textContent);

describe('GuestTable — share composer across a status change', () => {
	it('keeps the composer open while the guest is marked as sent, then regroups the row', async () => {
		render(<StatefulTable />);
		expect(groupCounts()).toEqual(['Por enviar2', 'Esperando respuesta1']);

		act(() => screen.getAllByRole('button', { name: 'Compartir invitación' })[0].click());
		await act(async () => screen.getByRole('button', { name: 'Registrar envío' }).click());

		expect(screen.getByRole('dialog', { name: 'Compositor' })).toBeInTheDocument();
		expect(groupCounts()).toEqual(['Por enviar2', 'Esperando respuesta1']);

		act(() => screen.getByRole('button', { name: 'Cerrar' }).click());

		expect(screen.queryByRole('dialog', { name: 'Compositor' })).not.toBeInTheDocument();
		expect(groupCounts()).toEqual(['Por enviar1', 'Esperando respuesta2']);
	});
});
