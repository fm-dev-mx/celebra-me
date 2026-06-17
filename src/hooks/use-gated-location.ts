import { useEffect, useRef, useState } from 'react';
import { rsvpApi } from '@/lib/client/rsvp-api';
import type { LocationSection, LocationVisibility } from '@/lib/adapters/types';

export interface UseGatedLocationInput {
	inviteId: string | undefined;
	isConfirmed: boolean;
	isDemoPreview: boolean | undefined;
	serverProvidedLocation: LocationSection | undefined;
	locationVisibility?: LocationVisibility;
}

export interface UseGatedLocationOutput {
	location: LocationSection | undefined;
	isFetching: boolean;
	error: string | undefined;
}

const FETCH_ERROR_MESSAGE = 'No se pudo cargar la ubicación. Intenta de nuevo más tarde.';

export function useGatedLocation({
	inviteId,
	isConfirmed,
	isDemoPreview,
	serverProvidedLocation,
	locationVisibility,
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

		if (locationVisibility !== 'after-rsvp' || !isConfirmed || !inviteId) {
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

		rsvpApi
			.getGatedLocation(inviteId)
			.then((payload) => {
				if (requestId !== latestFetchRef.current) return;
				setLocation(payload.location);
			})
			.catch(() => {
				if (requestId !== latestFetchRef.current) return;
				setError(FETCH_ERROR_MESSAGE);
			})
			.finally(() => {
				if (requestId !== latestFetchRef.current) return;
				setIsFetching(false);
			});

		return () => {
			latestFetchRef.current += 1;
		};
	}, [locationVisibility, isConfirmed, inviteId, isDemoPreview, serverProvidedLocation]);

	return { location, isFetching, error };
}
