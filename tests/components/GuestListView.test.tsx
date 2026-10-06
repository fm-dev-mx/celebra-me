import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import GuestListRow from '@/components/dashboard/guests/GuestListRow';
import GuestViewToggle from '@/components/dashboard/guests/GuestViewToggle';
import {
	GUEST_LIST_VIEW_STORAGE_KEY,
	useGuestListView,
} from '@/components/dashboard/guests/use-guest-list-view';
import { makeGuest } from '@tests/helpers/guest-factory';

describe('GuestListRow', () => {
	it('announces the guest, status and summary, and opens on tap', () => {
		const onOpen = jest.fn();
		const guest = makeGuest({
			fullName: 'Familia Pérez López',
			deliveryStatus: 'shared',
			isViewed: true,
			guestComment: 'Ahí estaremos',
		});
		render(<GuestListRow item={guest} onOpen={onOpen} />);

		const row = screen.getByRole('button', {
			name: 'Familia Pérez López. Esperando respuesta. 4 personas · Ya la abrió. Dejó un mensaje',
		});
		expect(row).not.toHaveAttribute('aria-expanded');
		fireEvent.click(row);
		expect(onOpen).toHaveBeenCalledWith(guest);
	});
});

describe('GuestViewToggle', () => {
	it('marks the active view and reports changes', () => {
		const onChange = jest.fn();
		render(<GuestViewToggle view="list" onChange={onChange} />);

		const group = screen.getByRole('group', { name: 'Ver como' });
		expect(within(group).getByRole('button', { name: 'Lista' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		fireEvent.click(within(group).getByRole('button', { name: 'Tarjetas' }));
		expect(onChange).toHaveBeenCalledWith('cards');
	});
});

describe('useGuestListView', () => {
	afterEach(() => window.localStorage.clear());

	it('defaults to the list and persists the host choice', () => {
		const { result } = renderHook(() => useGuestListView());
		expect(result.current[0]).toBe('list');

		act(() => result.current[1]('cards'));
		expect(result.current[0]).toBe('cards');
		expect(window.localStorage.getItem(GUEST_LIST_VIEW_STORAGE_KEY)).toBe('cards');
	});

	it('restores a stored choice and ignores unknown values', () => {
		window.localStorage.setItem(GUEST_LIST_VIEW_STORAGE_KEY, 'cards');
		expect(renderHook(() => useGuestListView()).result.current[0]).toBe('cards');

		window.localStorage.setItem(GUEST_LIST_VIEW_STORAGE_KEY, 'grid');
		expect(renderHook(() => useGuestListView()).result.current[0]).toBe('list');
	});
});
