import { act, renderHook } from '@testing-library/react';
import { useSendInvitation } from '@/components/dashboard/guests/use-send-invitation';
import { makeGuest } from '@tests/helpers/guest-factory';
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

function setupNavigatorShare(value = jest.fn().mockResolvedValue(undefined)) {
	Object.defineProperty(navigator, 'share', {
		value,
		configurable: true,
		writable: true,
	});
	return value;
}

function removeNavigatorShare() {
	delete (navigator as unknown as Record<string, unknown>).share;
}

describe('useSendInvitation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setupNavigatorShare();
		window.open = jest.fn().mockReturnValue({
			closed: false,
			location: { href: '' },
			close: jest.fn(),
		});
	});

	// --- Initial state ---

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

	// --- Save and share flow ---

	it('handleSaveAndShare calls onSave with updated fields and advances on success', async () => {
		const guest = makeGuest({ guestId: 'g-1', phone: '6691234567' });
		const guest2 = makeGuest({ guestId: 'g-2', fullName: 'Next Guest' });
		const updatedGuest = makeGuest({
			...guest,
			guestId: 'g-1',
			waShareUrl: 'https://wa.me/526691234567',
		});
		const callbacks = createMockCallbacks();
		callbacks.onSave.mockResolvedValue(updatedGuest);
		callbacks.onMarkShared.mockResolvedValue(undefined);

		const { result } = renderHook(() =>
			useSendInvitation({
				guest,
				pendingGuests: [guest, guest2],
				inviteBaseUrl: 'http://localhost',
				...callbacks,
			}),
		);

		await act(async () => {
			await result.current.handleSaveAndShare();
		});

		expect(callbacks.onSave).toHaveBeenCalledWith('g-1', {
			fullName: 'Guest One',
			maxAllowedAttendees: 4,
			phone: '6691234567',
			countryCode: '+52',
		});
		expect(callbacks.onMarkShared).toHaveBeenCalledWith(
			expect.objectContaining({ guestId: 'g-1' }),
		);
		expect(callbacks.onAdvanceFromGuest).toHaveBeenCalledWith('g-1');
	});

	it('handleSaveAndShare with empty phone shares saved invitation without saving', async () => {
		const guest = makeGuest({
			guestId: 'g-1',
			phone: '',
			waShareUrl: '',
			shareText: 'Saved share text',
			inviteId: 'invite-1',
		});
		const callbacks = createMockCallbacks();
		callbacks.onMarkShared.mockResolvedValue(undefined);

		const { result } = renderHook(() =>
			useSendInvitation({
				guest,
				pendingGuests: [guest],
				inviteBaseUrl: 'http://localhost',
				...callbacks,
			}),
		);

		await act(async () => {
			await result.current.handleSaveAndShare();
		});

		expect(navigator.share).toHaveBeenCalledWith({
			title: 'Invitación Celebra-me',
			text: 'Saved share text',
			url: 'http://localhost/invitacion/invite-1',
		});
		expect(callbacks.onSave).not.toHaveBeenCalled();
		expect(callbacks.onMarkShared).toHaveBeenCalledWith(guest);
		expect(callbacks.onAdvanceFromGuest).toHaveBeenCalledWith('g-1');
	});

	it('handleSaveAndShare with empty phone cancellation remains idle without fallback', async () => {
		setupNavigatorShare(
			jest.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError')),
		);
		const guest = makeGuest({ guestId: 'g-1', phone: '', waShareUrl: '' });
		const { result, callbacks } = setupHook(guest, [guest]);

		await act(async () => {
			await result.current.handleSaveAndShare();
		});

		expect(callbacks.onSave).not.toHaveBeenCalled();
		expect(callbacks.onMarkShared).not.toHaveBeenCalled();
		expect(callbacks.onAdvanceFromGuest).not.toHaveBeenCalled();
		expect(result.current.shareStatus).toBe('idle');
		expect(result.current.fallbackGuest).toBeNull();
	});

	it('handleSaveAndShare with empty phone unsupported native share shows fallback', async () => {
		removeNavigatorShare();
		const guest = makeGuest({ guestId: 'g-1', phone: '', waShareUrl: '' });
		const { result, callbacks } = setupHook(guest, [guest]);

		await act(async () => {
			await result.current.handleSaveAndShare();
		});

		expect(callbacks.onSave).not.toHaveBeenCalled();
		expect(callbacks.onMarkShared).not.toHaveBeenCalled();
		expect(callbacks.onAdvanceFromGuest).not.toHaveBeenCalled();
		expect(result.current.shareStatus).toBe('fallback');
		expect(result.current.fallbackGuest).toEqual(guest);
	});

	// --- Postpone advances ---

	it('handlePostpone calls onPostponeGuest with the current guest ID', () => {
		const guest = makeGuest({ guestId: 'g-1' });
		const guest2 = makeGuest({ guestId: 'g-2' });
		const { result, callbacks } = setupHook(guest, [guest, guest2]);

		act(() => {
			result.current.handlePostpone();
		});

		expect(callbacks.onPostponeGuest).toHaveBeenCalledWith('g-1');
	});

	// --- Save failure ---

	it('save failure does not advance and shows error', async () => {
		const guest = makeGuest({ guestId: 'g-1', phone: '6691234567' });
		const callbacks = createMockCallbacks();
		callbacks.onSave.mockRejectedValue(new Error('Save failed'));

		const { result } = renderHook(() =>
			useSendInvitation({
				guest,
				pendingGuests: [guest],
				inviteBaseUrl: 'http://localhost',
				...callbacks,
			}),
		);

		await act(async () => {
			await result.current.handleSaveAndShare();
		});

		expect(callbacks.onAdvanceFromGuest).not.toHaveBeenCalled();
		expect(callbacks.onMarkShared).not.toHaveBeenCalled();
		expect(result.current.phoneError).toBe('Error al guardar los datos. Intenta de nuevo.');
	});

	// --- MarkShared failure ---

	it('markShared failure does not advance and shows fallback', async () => {
		const guest = makeGuest({ guestId: 'g-1', phone: '6691234567' });
		const guest2 = makeGuest({ guestId: 'g-2' });
		const updatedGuest = makeGuest({
			...guest,
			guestId: 'g-1',
			waShareUrl: 'https://wa.me/526691234567',
		});
		const callbacks = createMockCallbacks();
		callbacks.onSave.mockResolvedValue(updatedGuest);
		callbacks.onMarkShared.mockRejectedValue(new Error('Mark failed'));

		const { result } = renderHook(() =>
			useSendInvitation({
				guest,
				pendingGuests: [guest, guest2],
				inviteBaseUrl: 'http://localhost',
				...callbacks,
			}),
		);

		await act(async () => {
			await result.current.handleSaveAndShare();
		});

		expect(callbacks.onAdvanceFromGuest).not.toHaveBeenCalled();
		expect(result.current.markError).toBe('Error al registrar el envío.');
		expect(result.current.shareStatus).toBe('fallback');
	});

	// --- Validations ---

	it('rejects invalid phone and does not call onSave', async () => {
		const guest = makeGuest({ guestId: 'g-1', phone: '123' });
		const { result, callbacks } = setupHook(guest, [guest]);

		await act(async () => {
			await result.current.handleSaveAndShare();
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
