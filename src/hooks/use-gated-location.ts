import { useEffect, useRef, useState } from 'react';
import { rsvpApi } from '@/lib/client/rsvp-api';
import { LOCATION_VISIBILITY_AFTER_RSVP } from '@/lib/invitation/location-policy';
import type { LocationSection, LocationVisibility } from '@/lib/adapters/types';

export interface UseGatedLocationInput {
	inviteId: string | undefined;
	isConfirmed: boolean;
	isDemoPreview: boolean | undefined;
	serverProvidedLocation: LocationSection | undefined;
	locationVisibility?: LocationVisibility;
	submitted?: boolean;
}

export interface UseGatedLocationOutput {
	location: LocationSection | undefined;
	isFetching: boolean;
	error: string | undefined;
}

const FETCH_ERROR_MESSAGE = 'No se pudo cargar la ubicación. Intenta de nuevo más tarde.';
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 500];

export function useGatedLocation({
	inviteId,
	isConfirmed,
	isDemoPreview,
	serverProvidedLocation,
	locationVisibility,
	submitted = true,
}: UseGatedLocationInput): UseGatedLocationOutput {
	const [location, setLocation] = useState<LocationSection | undefined>(serverProvidedLocation);
	const [isFetching, setIsFetching] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const latestFetchRef = useRef(0);

	useEffect(() => {
		function reset(): void {
			setLocation(undefined);
			setError(undefined);
			setIsFetching(false);
		}

		if (
			locationVisibility !== LOCATION_VISIBILITY_AFTER_RSVP ||
			!isConfirmed ||
			!submitted ||
			!inviteId
		) {
			reset();
			return;
		}

		if (serverProvidedLocation) {
			setLocation(serverProvidedLocation);
			setError(undefined);
			setIsFetching(false);
			return;
		}

		if (isDemoPreview) {
			reset();
			return;
		}

		const requestId = ++latestFetchRef.current;
		setIsFetching(true);
		setError(undefined);

		const attemptFetch = (attemptNumber: number): void => {
			rsvpApi
				.getGatedLocation(inviteId)
				.then((payload) => {
					if (requestId !== latestFetchRef.current) return;
					setLocation(payload.location);
					setError(undefined);
					setIsFetching(false);
				})
				.catch(() => {
					if (requestId !== latestFetchRef.current) return;

					if (attemptNumber < MAX_FETCH_ATTEMPTS) {
						setTimeout(
							() => attemptFetch(attemptNumber + 1),
							RETRY_DELAYS_MS[attemptNumber - 1],
						);
						return;
					}

					setError(FETCH_ERROR_MESSAGE);
					setIsFetching(false);
				});
		};

		attemptFetch(1);

		return () => {
			latestFetchRef.current += 1;
		};
	}, [
		locationVisibility,
		isConfirmed,
		inviteId,
		isDemoPreview,
		serverProvidedLocation,
		submitted,
	]);

	return { location, isFetching, error };
}
