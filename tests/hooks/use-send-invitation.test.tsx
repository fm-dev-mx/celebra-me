import { act, renderHook } from '@testing-library/react';
import { useSendInvitation } from '@/components/dashboard/guests/use-send-invitation';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	setupNavigatorShare,
	createMockWindow,
	stubWindowOpen,
} from '@tests/helpers/nav-test-utils';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

function createMockCallbacks() {
	return {
		onSave: jest.fn(),
		onMarkShared: jest.fn(),
		onAdvanceFromGuest: jest.fn(),
		onPostponeGuest: jest.fn(),
	};
}

function setupHook(
	guest: DashboardGuestItem | null,
	pendingGuests: DashboardGuestItem[],
	overrides?: Partial<ReturnType<typeof createMockCallbacks>>,
) {
	const callbacks = { ...createMockCallbacks(), ...overrides };

	const { result } = renderHook(() =>
		useSendInvitation({
			guest,
			pendingGuests,
			inviteBaseUrl: 'http://localhost',
			...callbacks,
		}),
	);

	return { result, callbacks };
}

describe('useSendInvitation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setupNavigatorShare();
		stubWindowOpen(createMockWindow() as unknown as Window);
	});

	it('initialises state from the selected guest', () => {
		const guest = makeGuest({
			guestId: 'g-1',
			fullName: 'Ana López',
			phone: '6691234567',
			countryCode: '+52',
			maxAllowedAttendees: 4,
		});
		const { result } = setupHook(guest, [guest]);

		expect(result.current.editName).toBe('Ana López');
		expect(result.current.editPhone).toBe('6691234567');
		expect(result.current.editCountryCode).toBe('+52');
		expect(result.current.editMaxAttendees).toBe(4);
		expect(result.current.shareStatus).toBe('idle');
		expect(result.current.pendingCount).toBe(1);
		expect(result.current.canSendToPhone).toBe(true);
	});

	it('uses defaults when guest has no phone', () => {
		const guest = makeGuest({ phone: '', countryCode: undefined });
		const { result } = setupHook(guest, [guest]);

		expect(result.current.editPhone).toBe('');
		expect(result.current.editCountryCode).toBe('+52');
		expect(result.current.canSendToPhone).toBe(false);
	});

	it('defaults to +52 country code when guest has no countryCode', () => {
		const guest = makeGuest({ countryCode: undefined });
		const { result } = setupHook(guest, [guest]);

		expect(result.current.editCountryCode).toBe('+52');
	});

	it('handlePostpone calls onPostponeGuest with the current guest ID', () => {
		const guest = makeGuest({ guestId: 'g-1' });
		const guest2 = makeGuest({ guestId: 'g-2' });
		const { result, callbacks } = setupHook(guest, [guest, guest2]);

		act(() => {
			result.current.handlePostpone();
		});

		expect(callbacks.onPostponeGuest).toHaveBeenCalledWith('g-1');
	});

	it('rejects invalid phone and does not call onSave', async () => {
		const guest = makeGuest({ guestId: 'g-1', phone: '123' });
		const { result, callbacks } = setupHook(guest, [guest]);

		act(() => {
			result.current.handleSaveAndShare();
		});

		expect(result.current.phoneError).toBe('El teléfono debe tener 10 dígitos.');
		expect(callbacks.onSave).not.toHaveBeenCalled();
	});

	it('pendingCount reflects only generated guests', () => {
		const guestA = makeGuest({ guestId: 'a', deliveryStatus: 'generated' });
		const guestB = makeGuest({ guestId: 'b', deliveryStatus: 'generated' });
		const guestC = makeGuest({ guestId: 'c', deliveryStatus: 'shared' });

		const { result } = setupHook(guestA, [guestA, guestB, guestC]);
		expect(result.current.pendingCount).toBe(2);
	});
});
