import { renderHook, waitFor } from '@testing-library/react';
import { useGatedLocation } from '@/hooks/use-gated-location';
import { rsvpApi } from '@/lib/client/rsvp-api';
import type { LocationSection } from '@/lib/adapters/types';

const mockLocation: LocationSection = {
	visibility: 'after-rsvp',
	introHeading: 'Ubicación',
	venues: [
		{
			venueEvent: 'Celebración',
			venueName: 'Salón de Prueba',
			address: 'Calle Falsa 123',
			date: '2026-08-01',
			time: '14:00',
			googleMapsUrl: 'https://maps.example.com/test',
		},
	],
};

jest.mock('@/lib/client/rsvp-api', () => ({
	rsvpApi: {
		getGatedLocation: jest.fn(),
	},
}));

const mockGetGatedLocation = rsvpApi.getGatedLocation as jest.Mock;

beforeEach(() => {
	jest.clearAllMocks();
});

describe('useGatedLocation', () => {
	it('returns server-provided location immediately without fetching', () => {
		const { result } = renderHook(() =>
			useGatedLocation({
				inviteId: 'mock-id',
				isConfirmed: true,
				isDemoPreview: false,
				serverProvidedLocation: mockLocation,
			}),
		);

		expect(result.current.location).toBe(mockLocation);
		expect(result.current.isFetching).toBe(false);
		expect(result.current.error).toBeUndefined();
		expect(mockGetGatedLocation).not.toHaveBeenCalled();
	});

	it('fetches gated location when not server-provided and conditions are met', async () => {
		mockGetGatedLocation.mockResolvedValue({ location: mockLocation });

		const { result } = renderHook(() =>
			useGatedLocation({
				inviteId: 'mock-id',
				isConfirmed: true,
				isDemoPreview: false,
				serverProvidedLocation: undefined,
			}),
		);

		expect(result.current.isFetching).toBe(true);
		expect(result.current.location).toBeUndefined();

		await waitFor(() => {
			expect(result.current.isFetching).toBe(false);
		});

		expect(result.current.location).toEqual(mockLocation);
		expect(result.current.error).toBeUndefined();
		expect(mockGetGatedLocation).toHaveBeenCalledWith('mock-id');
	});

	it('does not fetch when declined', () => {
		const { result } = renderHook(() =>
			useGatedLocation({
				inviteId: 'mock-id',
				isConfirmed: false,
				isDemoPreview: false,
				serverProvidedLocation: undefined,
			}),
		);

		expect(result.current.location).toBeUndefined();
		expect(result.current.isFetching).toBe(false);
		expect(mockGetGatedLocation).not.toHaveBeenCalled();
	});

	it('does not fetch when isDemoPreview is true', () => {
		const { result } = renderHook(() =>
			useGatedLocation({
				inviteId: 'mock-id',
				isConfirmed: true,
				isDemoPreview: true,
				serverProvidedLocation: undefined,
			}),
		);

		expect(result.current.location).toBeUndefined();
		expect(result.current.isFetching).toBe(false);
		expect(mockGetGatedLocation).not.toHaveBeenCalled();
	});

	it('sets error when fetch fails', async () => {
		mockGetGatedLocation.mockRejectedValue(new Error('Network error'));

		const { result } = renderHook(() =>
			useGatedLocation({
				inviteId: 'mock-id',
				isConfirmed: true,
				isDemoPreview: false,
				serverProvidedLocation: undefined,
			}),
		);

		await waitFor(() => {
			expect(result.current.isFetching).toBe(false);
		});

		expect(result.current.location).toBeUndefined();
		expect(result.current.error).toBeDefined();
	});

	it('clears location when isConfirmed becomes false', () => {
		const { result, rerender } = renderHook(
			({ isConfirmed }) =>
				useGatedLocation({
					inviteId: 'mock-id',
					isConfirmed,
					isDemoPreview: false,
					serverProvidedLocation: mockLocation,
				}),
			{ initialProps: { isConfirmed: true } },
		);

		expect(result.current.location).toBe(mockLocation);

		rerender({ isConfirmed: false });

		expect(result.current.location).toBeUndefined();
		expect(result.current.error).toBeUndefined();
	});

	it('does not fetch when inviteId is missing', () => {
		const { result } = renderHook(() =>
			useGatedLocation({
				inviteId: undefined,
				isConfirmed: true,
				isDemoPreview: false,
				serverProvidedLocation: undefined,
			}),
		);

		expect(result.current.location).toBeUndefined();
		expect(result.current.isFetching).toBe(false);
		expect(mockGetGatedLocation).not.toHaveBeenCalled();
	});

	it('discards stale response when inviteId changes mid-fetch', async () => {
		let resolveFirst: ((value: unknown) => void) | undefined;
		mockGetGatedLocation.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveFirst = resolve;
			}),
		);

		const { result, rerender } = renderHook(
			({ inviteId }) =>
				useGatedLocation({
					inviteId,
					isConfirmed: true,
					isDemoPreview: false,
					serverProvidedLocation: undefined,
				}),
			{ initialProps: { inviteId: 'first-id' } },
		);

		expect(result.current.isFetching).toBe(true);
		expect(mockGetGatedLocation).toHaveBeenCalledWith('first-id');

		mockGetGatedLocation.mockResolvedValue({ location: mockLocation });
		rerender({ inviteId: 'second-id' });

		// First fetch resolves now — should be discarded by request-id guard
		resolveFirst?.({ location: { ...mockLocation, introHeading: 'Stale' } });

		await waitFor(() => {
			expect(result.current.isFetching).toBe(false);
		});

		expect(result.current.location?.introHeading).toBe('Ubicación');
		expect(mockGetGatedLocation).toHaveBeenCalledTimes(2);
		expect(mockGetGatedLocation).toHaveBeenLastCalledWith('second-id');
	});

	it('discards stale response when isConfirmed toggles mid-fetch', async () => {
		let resolveFetch: ((value: unknown) => void) | undefined;
		mockGetGatedLocation.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveFetch = resolve;
			}),
		);

		const { result, rerender } = renderHook(
			({ isConfirmed }) =>
				useGatedLocation({
					inviteId: 'mock-id',
					isConfirmed,
					isDemoPreview: false,
					serverProvidedLocation: undefined,
				}),
			{ initialProps: { isConfirmed: true } },
		);

		expect(result.current.isFetching).toBe(true);

		rerender({ isConfirmed: false });

		expect(result.current.location).toBeUndefined();
		expect(result.current.error).toBeUndefined();
		expect(result.current.isFetching).toBe(false);

		// Old fetch resolves — should be discarded
		resolveFetch?.({ location: mockLocation });

		await waitFor(() => {
			expect(result.current.location).toBeUndefined();
		});
	});

	it('prefers server-provided location over in-flight fetch and discards stale response', async () => {
		let resolveFetch: ((value: unknown) => void) | undefined;
		mockGetGatedLocation.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveFetch = resolve;
			}),
		);

		type LocationProp = { serverProvidedLocation: LocationSection | undefined };
		const initialProps: LocationProp = { serverProvidedLocation: undefined };

		const { result, rerender } = renderHook(
			({ serverProvidedLocation }: LocationProp) =>
				useGatedLocation({
					inviteId: 'mock-id',
					isConfirmed: true,
					isDemoPreview: false,
					serverProvidedLocation,
				}),
			{ initialProps },
		);

		expect(result.current.isFetching).toBe(true);

		// Server provides location while fetch is in-flight
		rerender({ serverProvidedLocation: mockLocation });

		expect(result.current.location).toEqual(mockLocation);
		expect(result.current.isFetching).toBe(false);
		expect(result.current.error).toBeUndefined();

		// Old fetch resolves — should be discarded by request-id guard
		resolveFetch?.({ location: { ...mockLocation, introHeading: 'Stale' } });

		await waitFor(() => {
			expect(result.current.location?.introHeading).toBe('Ubicación');
		});
	});
});
