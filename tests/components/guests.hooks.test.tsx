import { renderHook, act, waitFor } from '@testing-library/react';
import { useGuests } from '@/components/dashboard/guests/useGuests';
import { useGuestMutations } from '@/components/dashboard/guests/useGuestMutations';

class MockEventSource {
	addEventListener = jest.fn();
	close = jest.fn();
	onerror: (() => void) | null = null;

	constructor(public url: string) {}
}

describe('useGuests hook', () => {
	const originalFetch = global.fetch;
	const originalEventSource = (global as unknown as { EventSource?: unknown }).EventSource;

	beforeEach(() => {
		(global as unknown as { EventSource: unknown }).EventSource = MockEventSource;
		jest.clearAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
		(global as unknown as { EventSource?: unknown }).EventSource = originalEventSource;
		jest.restoreAllMocks();
	});

	it('returns initial state correctly', () => {
		const { result } = renderHook(() => useGuests({ eventId: '' }));

		expect(result.current.items).toEqual([]);
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBe('');
		expect(result.current.realtimeState).toBe('fallback');
	});

	it('sets loading state while fetching', async () => {
		let resolveFetch: (value: unknown) => void;
		const fetchPromise = new Promise((resolve) => {
			resolveFetch = resolve;
		});

		global.fetch = jest.fn().mockReturnValue(fetchPromise);

		const { result } = renderHook(() => useGuests({ eventId: 'event-123' }));

		expect(result.current.loading).toBe(true);

		await act(async () => {
			resolveFetch!({
				ok: true,
				status: 200,
				json: async () => ({
					items: [],
					totals: {
						totalInvitations: 0,
						totalPeople: 0,
						pendingInvitations: 0,
						pendingPeople: 0,
						confirmedInvitations: 0,
						confirmedPeople: 0,
						declinedInvitations: 0,
						declinedPeople: 0,
						viewed: 0,
					},
					updatedAt: new Date().toISOString(),
				}),
			});
		});

		expect(result.current.loading).toBe(false);
	});

	it('sets error state on failed fetch', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ message: 'Server error' }),
		});

		const { result } = renderHook(() => useGuests({ eventId: 'event-123' }));

		await waitFor(() => {
			expect(result.current.error).toBe('Server error');
		});

		expect(result.current.loading).toBe(false);
	});

	it('does not fetch when eventId is empty', async () => {
		const fetchSpy = jest.spyOn(global, 'fetch');

		const { result } = renderHook(() => useGuests({ eventId: '' }));

		await act(async () => {
			await Promise.resolve();
		});

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(result.current.items).toEqual([]);
	});
});

describe('useGuestMutations hook', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	it('returns initial loading state as false', () => {
		const { result } = renderHook(() =>
			useGuestMutations({
				eventId: 'event-123',
				onSuccess: jest.fn(),
				onError: jest.fn(),
				onRefresh: jest.fn(),
			}),
		);

		expect(result.current.loading).toBe(false);
	});

	it('calls onSuccess callback on successful create', async () => {
		const onSuccess = jest.fn();
		const onRefresh = jest.fn();

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({
				item: {
					guestId: 'guest-123',
					fullName: 'Test Guest',
					attendanceStatus: 'pending',
				},
			}),
		});

		const { result } = renderHook(() =>
			useGuestMutations({
				eventId: 'event-123',
				onSuccess,
				onRefresh,
			}),
		);

		await act(async () => {
			await result.current.createGuest({ fullName: 'Test Guest' });
		});

		expect(onSuccess).toHaveBeenCalledWith('Invitado Test Guest guardado correctamente.');
		expect(onRefresh).toHaveBeenCalled();
	});

	it('calls onError callback on failed create', async () => {
		const onError = jest.fn();

		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({ message: 'Validation error' }),
		});

		const { result } = renderHook(() =>
			useGuestMutations({
				eventId: 'event-123',
				onError,
			}),
		);

		await act(async () => {
			await result.current.createGuest({ fullName: '' });
		});

		expect(onError).toHaveBeenCalled();
	});

	it('calls onSuccess callback on successful update', async () => {
		const onSuccess = jest.fn();
		const onRefresh = jest.fn();

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				item: {
					guestId: 'guest-123',
					fullName: 'Updated Guest',
					attendanceStatus: 'confirmed',
				},
			}),
		});

		const { result } = renderHook(() =>
			useGuestMutations({
				eventId: 'event-123',
				onSuccess,
				onRefresh,
			}),
		);

		await act(async () => {
			await result.current.updateGuest('guest-123', { fullName: 'Updated Guest' });
		});

		expect(onSuccess).toHaveBeenCalledWith('Invitado Updated Guest actualizado correctamente.');
		expect(onRefresh).toHaveBeenCalled();
	});

	it('calls onSuccess callback on successful delete', async () => {
		const onSuccess = jest.fn();
		const onRefresh = jest.fn();

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ message: 'Deleted successfully' }),
		});

		const { result } = renderHook(() =>
			useGuestMutations({
				eventId: 'event-123',
				onSuccess,
				onRefresh,
			}),
		);

		await act(async () => {
			await result.current.deleteGuest('guest-123');
		});

		expect(onSuccess).toHaveBeenCalledWith('Invitado eliminado con éxito.');
		expect(onRefresh).toHaveBeenCalled();
	});

	it('calls onSuccess callback on successful markShared', async () => {
		const onSuccess = jest.fn();
		const onRefresh = jest.fn();

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				item: {
					guestId: 'guest-123',
					deliveryStatus: 'shared',
				},
			}),
		});

		const { result } = renderHook(() =>
			useGuestMutations({
				eventId: 'event-123',
				onSuccess,
				onRefresh,
			}),
		);

		await act(async () => {
			await result.current.markShared('guest-123');
		});

		expect(onSuccess).toHaveBeenCalledWith('¡Invitación compartida! 🎉');
		expect(onRefresh).toHaveBeenCalled();
	});
});
