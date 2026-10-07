import { useCallback, useEffect, useState } from 'react';

export type GuestListView = 'list' | 'cards';

export const GUEST_LIST_VIEW_STORAGE_KEY = 'rsvp-dashboard-guest-view';

function readStoredView(): GuestListView | null {
	try {
		const stored = window.localStorage.getItem(GUEST_LIST_VIEW_STORAGE_KEY);
		return stored === 'list' || stored === 'cards' ? stored : null;
	} catch {
		return null;
	}
}

/**
 * Compact-screen guest view preference. Defaults to the list and restores the
 * host's last choice after hydration so server and client markup match.
 */
export function useGuestListView(): [GuestListView, (view: GuestListView) => void] {
	const [view, setViewState] = useState<GuestListView>('list');

	useEffect(() => {
		const stored = readStoredView();
		if (stored) setViewState(stored);
	}, []);

	const setView = useCallback((next: GuestListView) => {
		setViewState(next);
		try {
			window.localStorage.setItem(GUEST_LIST_VIEW_STORAGE_KEY, next);
		} catch {
			// Storage can be unavailable (private mode); the choice still applies for this visit.
		}
	}, []);

	return [view, setView];
}
