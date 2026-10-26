import { act, render, screen } from '@testing-library/react';
import GuestTable from '@/components/dashboard/guests/GuestTable';
import { makeGuest } from '@tests/helpers/guest-factory';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

jest.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
jest.mock('@/components/dashboard/guests/ShareAction', () => ({
	__esModule: true,
	default: () => <div data-testid="share-action" />,
}));

const items = [
	makeGuest({ guestId: 'a', fullName: 'Carlos', deliveryStatus: 'generated' }),
	makeGuest({ guestId: 'b', fullName: 'Tía Carmen', deliveryStatus: 'generated' }),
	makeGuest({ guestId: 'c', fullName: 'Familia López', deliveryStatus: 'shared' }),
	makeGuest({ guestId: 'd', fullName: 'Familia Ruiz', deliveryStatus: 'shared' }),
	makeGuest({
		guestId: 'e',
		fullName: 'Sofía',
		deliveryStatus: 'shared',
		attendanceStatus: 'confirmed',
		maxAllowedAttendees: 2,
		attendeeCount: 2,
	}),
];

const renderTable = (props: Partial<React.ComponentProps<typeof GuestTable>> = {}) =>
	render(
		<GuestTable
			items={items}
			inviteBaseUrl="https://example.com"
			eventTitle="XV de Mía"
			shareTemplates={{ invitation: '{inviteUrl}', reminder: '{inviteUrl}' }}
			shareDateContext={defaultShareDateContext()}
			onMarkShared={jest.fn().mockResolvedValue(undefined)}
			onOpenDetails={jest.fn()}
			{...props}
		/>,
	);

const groupToggle = (title: string) =>
	screen.getByRole('button', { name: new RegExp(String.raw`^${title}\s*\d+$`) });

describe('GuestTable — desktop groups by status', () => {
	it('renders one collapsible header per non-empty status, in journey order', () => {
		renderTable();
		const headers = screen
			.getAllByRole('button', { expanded: true })
			.map((button) => button.textContent);
		expect(headers).toEqual(['Por enviar2', 'Esperando respuesta2', 'Confirmados1']);
		expect(screen.getByText('2 personas')).toBeInTheDocument();
	});

	it('collapses and expands a group from its header', () => {
		renderTable();
		act(() => groupToggle('Por enviar').click());
		expect(groupToggle('Por enviar')).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('button', { name: 'Carlos' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sofía' })).toBeInTheDocument();
		act(() => groupToggle('Por enviar').click());
		expect(screen.getByRole('button', { name: 'Carlos' })).toBeInTheDocument();
	});

	it('offers sending to the whole unsent group', () => {
		const onRequestBatch = jest.fn();
		renderTable({ onRequestBatch });
		act(() => screen.getByRole('button', { name: 'Enviar a los 2' }).click());
		expect(onRequestBatch).toHaveBeenCalledWith('invitation', new Set(['a', 'b']));
	});

	it('offers reminding only the reminder-eligible guests, and only in reminder mode', () => {
		const onRequestBatch = jest.fn();
		const { unmount } = renderTable({ onRequestBatch });
		expect(screen.queryByRole('button', { name: /^Recordar a los/ })).not.toBeInTheDocument();
		unmount();

		renderTable({ onRequestBatch, reminderMode: true, eligibleGuestIds: new Set(['c', 'd']) });
		act(() => screen.getByRole('button', { name: 'Recordar a los 2' }).click());
		expect(onRequestBatch).toHaveBeenCalledWith('reminder', new Set(['c', 'd']));
	});

	it('hides the group action when it would reach a single guest', () => {
		renderTable({
			onRequestBatch: jest.fn(),
			reminderMode: true,
			eligibleGuestIds: new Set(['c']),
		});
		expect(screen.queryByRole('button', { name: /^Recordar a los/ })).not.toBeInTheDocument();
	});
});
